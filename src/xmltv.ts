import type { GridApiResponse } from "./tvlistings.js";
import { Command } from "commander";

export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const YYYY = d.getUTCFullYear();
  const MM = pad(d.getUTCMonth() + 1);
  const DD = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${YYYY}${MM}${DD}${hh}${mm}${ss} +0000`;
}

const cli = new Command();
cli
  .option("--appendAsterisk", "Append * to titles with <new /> or <live />")
  .option("--mediaportal", "Prioritize xmltv_ns episode-num tags")
  .option("--lineupId <lineupId>", "Lineup ID")
  .option("--timespan <hours>", "Timespan in hours (up to 360)", "6")
  .option("--pref <prefs>", "User Preferences, e.g. m,p,h")
  .option("--country <code>", "Country code", "USA")
  .option("--postalCode <zip>", "Postal code", "30309")
  .option("--userAgent <agent>", "Custom user agent string")
  .option("--timezone <zone>", "Timezone")
  .option("--outputFile <filename>", "Output file name", "xmltv.xml");
cli.parse(process.argv);
const options = cli.opts() as { [key: string]: any };

// Helper to mimic Perl dd_progid emission: (..########)(####) -> XX########.####
function toDdProgid(rawId: string | undefined | null): string | null {
  if (!rawId) return null;
  const m = rawId.match(/^(.{2}\d{8})(\d{4})$/);
  return m ? `${m[1]}.${m[2]}` : null;
}

export function buildChannelsXml(data: GridApiResponse): string {
  let xml = "";

  // Sort channels by channelId for deterministic <channel> order
  const sortedChannels = [...data.channels].sort((a, b) =>
    a.channelId.localeCompare(b.channelId, undefined, { numeric: true, sensitivity: "base" })
  );

  for (const channel of sortedChannels) {
    xml += `  <channel id="${escapeXml(channel.channelId)}">\n`;
    xml += `    <display-name>${escapeXml(channel.callSign)}</display-name>\n`;
    if (channel.channelNo) {
      xml += `    <display-name>${escapeXml(channel.channelNo + ' ' + channel.callSign)}</display-name>\n`;
    }


    if (channel.affiliateName) {
      xml += `    <display-name>${escapeXml(channel.affiliateName)}</display-name>\n`;
    }

    if (channel.channelNo) {
      xml += `    <display-name>${escapeXml(channel.channelNo)}</display-name>\n`;
    }

    if (channel.thumbnail) {
      let src = channel.thumbnail.startsWith("http")
        ? channel.thumbnail
        : "https:" + channel.thumbnail;
      // Strip any query string like ?w=55
      const queryIndex = src.indexOf("?");
      if (queryIndex !== -1) {
        src = src.substring(0, queryIndex);
      }
      xml += `    <icon src="${escapeXml(src)}" />\n`;
    }

    xml += "  </channel>\n";
  }
  return xml;
}

export function buildProgramsXml(data: GridApiResponse): string {
  let xml = "";

  const matchesPreviouslyShownPattern = (programId: string): boolean => {
    return /^EP|^SH|^\d/.test(programId);
  };

  const convOAD = (originalAirDate: string): string => {
    return originalAirDate.replace(/-/g, "");
  };

  // Sort channels by channelId so <programme> blocks group by channel
  const sortedChannels = [...data.channels].sort((a, b) =>
    a.channelId.localeCompare(b.channelId, undefined, { numeric: true, sensitivity: "base" })
  );

  for (const channel of sortedChannels) {
    // Sort events by startTime within each channel
    const sortedEvents = [...channel.events].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    for (const event of sortedEvents) {
      xml += `  <programme start="${formatDate(
        event.startTime
      )}" stop="${formatDate(event.endTime)}" channel="${escapeXml(channel.channelId)}">\n`;

      const isNew = event.flag?.includes("New");
      const isLive = event.flag?.includes("Live");
      let title = event.program.title;
      if (options["appendAsterisk"] && (isNew || isLive)) {
        title += " *";
      }
      xml += `    <title>${escapeXml(title)}</title>\n`;

      if (event.program.episodeTitle) {
        xml += `    <sub-title>${escapeXml(event.program.episodeTitle)}</sub-title>\n`;
      }

      if (event.program.shortDesc) {
        xml += `    <desc>${escapeXml(event.program.shortDesc)}</desc>\n`;
      }

      // Date logic: releaseYear first, else current date from startTime (America/New_York)
      if (event.program.releaseYear) {
        xml += `    <date>${escapeXml(event.program.releaseYear)}</date>\n`;
      } else {
        const nyFormatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const parts = nyFormatter.formatToParts(new Date(event.startTime));
        const year = parseInt(parts.find((p) => p.type === "year")?.value || "1970", 10);
        const mm = parts.find((p) => p.type === "month")?.value || "01";
        const dd = parts.find((p) => p.type === "day")?.value || "01";
        xml += `    <date>${year}${mm}${dd}</date>\n`;
      }

      const genreSet = new Set(event.program.genres?.map((g) => g.toLowerCase()) || []);

      if (event.program.genres && event.program.genres.length > 0) {
        const sortedGenres = [...event.program.genres].sort((a, b) => a.localeCompare(b));
        for (const genre of sortedGenres) {
          const capitalizedGenre = genre.charAt(0).toUpperCase() + genre.slice(1);
          xml += `    <category lang="en">${escapeXml(capitalizedGenre)}</category>\n`;
        }
      }

      // Add <length> after categories
      if (event.duration) {
        xml += `    <length units="minutes">${escapeXml(event.duration)}</length>\n`;
      }

      if (event.thumbnail) {
        const src = event.thumbnail.startsWith("http")
          ? event.thumbnail
          : "https://zap2it.tmsimg.com/assets/" + event.thumbnail + ".jpg";
        xml += `    <icon src="${escapeXml(src)}" />\n`;
      }

      if (event.program.seriesId && (event.program as any).tmsId) {
        const encodedUrl = `https://tvlistings.gracenote.com//overview.html?programSeriesId=${event.program.seriesId}&amp;tmsId=${(event.program as any).tmsId}`;
        xml += `    <url>${encodedUrl}</url>\n`;
      }

      const skipXmltvNs = genreSet.has("movie") || genreSet.has("sports");
      const episodeNumTags: string[] = [];

      // ---- dd_progid (Perl behavior) — compute once, independent of season/episode presence
      const ddProgid = toDdProgid(event.program.id);
      if (ddProgid) {
        episodeNumTags.push(`    <episode-num system="dd_progid">${escapeXml(ddProgid)}</episode-num>\n`);
      }
      // ----------------------------------------------------------------------

      if (event.program.season && event.program.episode && !skipXmltvNs) {
        const onscreen = `S${event.program.season.padStart(2, "0")}E${event.program.episode.padStart(2, "0")}`;
        episodeNumTags.push(`    <episode-num system="onscreen">${escapeXml(onscreen)}</episode-num>\n`);
        episodeNumTags.push(`    <episode-num system="common">${escapeXml(onscreen)}</episode-num>\n`);

        const seasonNum = parseInt(event.program.season, 10);
        const episodeNum = parseInt(event.program.episode, 10);
        if (!isNaN(seasonNum) && !isNaN(episodeNum) && seasonNum >= 1 && episodeNum >= 1) {
          const xmltvNsTag = `    <episode-num system="xmltv_ns">${seasonNum - 1}.${episodeNum - 1}.</episode-num>\n`;
          if (options["mediaportal"]) {
            episodeNumTags.unshift(xmltvNsTag);
          } else {
            episodeNumTags.push(xmltvNsTag);
          }
        }
      } else if (!event.program.season && event.program.episode && !skipXmltvNs) {
        const nyFormatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const parts = nyFormatter.formatToParts(new Date(event.startTime));
        const year = parseInt(parts.find((p) => p.type === "year")?.value || "1970", 10);
        const episodeIdx = parseInt(event.program.episode, 10);
        if (!isNaN(episodeIdx)) {
          const xmltvNsTag = `    <episode-num system="xmltv_ns">${year - 1}.${episodeIdx - 1}.0/1</episode-num>\n`;
          if (options["mediaportal"]) {
            episodeNumTags.unshift(xmltvNsTag);
          } else {
            episodeNumTags.push(xmltvNsTag);
          }
        }
      } else if (!event.program.episode && event.program.id) {
        // No season/episode — xmltv_ns based on MMDD (only if not movie/sports)
        const nyFormatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const parts = nyFormatter.formatToParts(new Date(event.startTime));
        const year = parseInt(parts.find((p) => p.type === "year")?.value || "1970", 10);
        const mm = parts.find((p) => p.type === "month")?.value || "01";
        const dd = parts.find((p) => p.type === "day")?.value || "01";

        if (!skipXmltvNs) {
          const mmddNum = parseInt(`${mm}${dd}`, 10);
          const mmddMinusOne = (mmddNum - 1).toString().padStart(4, "0");
          const xmltvNsTag = `    <episode-num system="xmltv_ns">${year - 1}.${mmddMinusOne}.</episode-num>\n`;
          if (options["mediaportal"]) {
            episodeNumTags.unshift(xmltvNsTag);
          } else {
            episodeNumTags.push(xmltvNsTag);
          }
        }
      }

      xml += episodeNumTags.join("");

      if (event.program.originalAirDate || event.program.episodeAirDate) {
        const airDate = new Date(event.program.episodeAirDate || event.program.originalAirDate || "");
        if (!isNaN(airDate.getTime())) {
          xml += `    <episode-num system="original-air-date">${airDate
            .toISOString()
            .replace("T", " ")
            .split(".")[0]}</episode-num>\n`;
        }
      }

      if (isNew) xml += `    <new />\n`;
      if (isLive) xml += `    <live />\n`;
      if (event.flag?.includes("Premiere")) xml += `    <premiere />\n`;
      if (event.flag?.includes("Finale")) xml += `    <last-chance />\n`;

      if (!isNew && !isLive && event.program.id && matchesPreviouslyShownPattern(event.program.id)) {
        xml += `    <previously-shown`;
        if (event.program.originalAirDate) {
          const date = convOAD(event.program.originalAirDate);
          xml += ` start="${date}000000"`;
        }
        xml += ` />\n`;
      }

      if (event.tags && event.tags.length > 0) {
        if (event.tags.includes("Stereo")) {
          xml += `    <audio type="stereo" />\n`;
        }
        if (event.tags.includes("CC")) {
          xml += `    <subtitles type="teletext" />\n`;
        }
      }

      if (event.rating) {
        xml += `    <rating system="MPAA"><value>${escapeXml(event.rating)}</value></rating>\n`;
      }

      xml += "  </programme>\n";
    }
  }

  return xml;
}

export function buildXmltv(data: GridApiResponse): string {
  console.log("Building XMLTV file");

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<tv generator-info-name="jef/zap2xml" generator-info-url="https://github.com/jef/zap2xml">\n';
  xml += buildChannelsXml(data);
  xml += buildProgramsXml(data);
  xml += "</tv>\n";

  return xml;
}
