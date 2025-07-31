import { getConfig } from "./config.js";

const config = getConfig();

export interface Program {
  title: string;
  id: string;
  tmsId: string;
  shortDesc: string | null;
  season: string | null;
  releaseYear: string | null;
  episode: string | null;
  episodeTitle: string | null;
  seriesId: string;
  isGeneric: string;
  originalAirDate?: string;
  genres?: string[];
}

export interface Event {
  callSign: string;
  duration: string;
  startTime: string;
  endTime: string;
  thumbnail: string | null;
  channelNo: string;
  filter?: string[];
  seriesId: string;
  rating: string | null;
  flag: string[];
  tags: string[];
  program: Program;
}

export interface Channel {
  callSign: string;
  affiliateName: string | null;
  affiliateCallSign: string | null;
  channelId: string;
  channelNo: string | null;
  events: Event[];
  id: string;
  stationGenres: boolean[];
  stationFilters: string[];
  thumbnail: string | null;
}

export interface GridApiResponse {
  channels: Channel[];
}

function buildUrl(time: number, timespan: number): string {
  const params = {
    lineupId: config.lineupId,
    timespan: timespan.toString(),
    headendId: config.headendId,
    country: config.country,
    timezone: config.timezone,
    postalCode: config.postalCode,
    isOverride: "true",
    pref: config.pref + "16,128" || "16,128",
    aid: "chi",
    languagecode: "en-us",
    time: time.toString(),
    device: "X",
    userId: "-",
  };

  const urlParams = new URLSearchParams(params).toString();

  return `${config.baseUrl}?${urlParams}`;
}

export async function getTVListings(): Promise<GridApiResponse> {
  const totalHours = parseInt(config.timespan, 10);
  const chunkHours = 6;
  const now = Math.floor(Date.now() / 1000);
  const channelsMap: Map<string, Channel> = new Map();

  console.log(`Fetching ${totalHours} hours of TV listings in ${chunkHours}-hour chunks...`);
  
  const fetchPromises: Promise<void>[] = [];

  for (let offset = 0; offset < totalHours; offset += chunkHours) {
    const time = now + offset * 3600;
    const url = buildUrl(time, chunkHours);

    console.log(`Fetching chunk ${offset / chunkHours + 1}/${Math.ceil(totalHours / chunkHours)}: ${url}`);

    const fetchPromise = fetch(url, {
      headers: {
        "User-Agent": config.userAgent || "",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `Failed to fetch URL ${url}: ${response.status} ${response.statusText} - ${errorBody.substring(0, 200)}...`,
          );
        }
        return response.json() as Promise<GridApiResponse>;
      })
      .then((chunkData: GridApiResponse) => {
        console.log(`Chunk ${offset / chunkHours + 1} returned ${chunkData.channels.length} channels`);
        for (const newChannel of chunkData.channels) {
          const processedEvents = newChannel.events.map(event => {
            const newProgram = { ...event.program };
            const currentGenres = new Set<string>(newProgram.genres || []);

            if (event.filter && event.filter.length > 0) {
              event.filter.forEach(filterTag => {
                const genre = filterTag.replace(/filter-/i, '').toLowerCase();
                if (genre) {
                  currentGenres.add(genre);
                }
              });
            }

            const isMovie = newProgram.id?.startsWith('MV');

            if (currentGenres.size === 0 && !isMovie) {
                if (newProgram.seriesId && newProgram.seriesId !== '0') {
                    currentGenres.add('series');
                }
            }

            newProgram.genres = Array.from(currentGenres);

            return { ...event, program: newProgram };
          });

          if (!channelsMap.has(newChannel.channelId)) {
            channelsMap.set(newChannel.channelId, {
              ...newChannel,
              events: processedEvents,
            });
          } else {
            const existingChannel = channelsMap.get(newChannel.channelId)!;
            existingChannel.events.push(...processedEvents);
          }
        }
      })
      .catch(fetchError => {
        console.error(`Error fetching chunk ${offset / chunkHours + 1}:`, fetchError);
        throw fetchError;
      });

    fetchPromises.push(fetchPromise);
  }

  console.log("Waiting for all chunks to complete...");
  await Promise.all(fetchPromises);

  console.log(`Completed fetching TV listings. Total unique channels: ${channelsMap.size}`);
  return { channels: Array.from(channelsMap.values()) };
}
