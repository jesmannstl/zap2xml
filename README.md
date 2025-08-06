# zap2xml

Automate TV guides to XMLTV format. Easy to use, up-to-date. See below for getting started.

I also *somewhat* maintain a version of the original in the [historical-perl branch](https://github.com/jef/zap2xml/tree/historical-perl) if you're interested in that.



## (2025-08-06)

### Changes since previous release

These changes are currently on the [jesmannstl/zap2xml](https://github.com/jesmannstl/zap2xml) fork

* Added Category if available (Movie, Sports, News, Talk, Family etc)
* Added Category "Series" to all programs that did not return a category
* Added additional Season Episode formats for various players
* Added year as Season for programs that only list an episode number like daily cable news
* Added <date> tag to all programs without an aired date normalized to America/New York
* Added xmltv\_ns with the date aired as Season YYYY Episode MMYY to Non Movie or Sports with no other Season/Episode like local news so would have the ability to record as Series is most players.
* Added URL to program details from old Perl function.
* Added --appendAsterisk to add \* to title on programs that are New and/or Live
* Added <previously-shown /> tag to programs that are not <New> and/or <Live>
* Updated affiliateId after orbebb stopped working

Updated Docker with these changes use APPEND\_ASTERISK: TRUE for the --appendAsterisk option



## How to use

### Node.js

```bash
npm i \&\& npm run build \&\& node dist/index.js
```

See [Command line arguments](#command-line-arguments) for configuration options.

### Docker

| Tag     | Description             |
| ------- | ----------------------- |
| latest  | Stable zap2xml releases |
| nightly | HEAD zap2xml release    |

#### docker-compose

```yaml
services:
  zap2xml:
    container\_name: zap2xml
    image: ghcr.io/jesmannstl/zap2xml:latest
    environment:
      OUTPUT\_FILE: /xmltv/xmltv.xml
    volumes:
      - ./xmltv:/xmltv
    restart: unless-stopped
```

#### docker run

For a simple Docker run command:

```bash
docker run -d --name zap2xml \\
  -v /path/to/output:/xmltv \\
  -e OUTPUT\_FILE=/xmltv/xmltv.xml \\
  ghcr.io/jesmannstl/zap2xml:latest
```

**Note**: This is a Node.js application, not PHP. Do not use `php zap2xml.php` commands with this container.

See [Environment variables](#environment-variables) for configuration options.

## Configuration

### Environment variables

| Variable          | Description                                                                                                     | Default                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `LINEUP\_ID`       | Lineup ID; Read more in the \[Wiki](https://github.com/jef/zap2xml/wiki/Retrieving-Lineup-ID)                    | `USA-lineupId-DEFAULT` (Attenna) |
| `TIMESPAN`        | Timespan in hours (up to 360 = 15 days, default: 6)                                                             | 6                                |
| `PREF`            | User Preferences, comma separated list. `m` for showing music, `p` for showing pay-per-view, `h` for showing HD | (empty)                          |
| `COUNTRY`         | Country code (default: `USA`)                                                                                   | USA                              |
| `POSTAL\_CODE`     | Postal code of where shows are available.                                                                       | 30309                            |
| `USER\_AGENT`      | Custom user agent string for HTTP requests.                                                                     | Uses random if not specified     |
| `TZ`              | Timezone                                                                                                        | System default                   |
| `SLEEP\_TIME`      | Sleep time before next run in seconds (default: 21600, Only used with Docker.)                                  | 21600                            |
| `OUTPUT\_FILE`     | Output file name (default: xmltv.xml)                                                                           | xmltv.xml                        |
| `APPEND\_ASTERISK` | Set `TRUE` to add \* to Programs that are New or Live                                                  | FALSE                            |

### Command line arguments

| Argument       | Description                                                                                                     | Default                          |
| -----------------  | --------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `--lineupId`       | Lineup ID; Read more in the \[Wiki](https://github.com/jef/zap2xml/wiki/Retrieving-Lineup-ID)                    | `USA-lineupId-DEFAULT` (Attenna) |
| `--timespan`       | Timespan in hours (up to 360 = 15 days, default: 6)                                                             | 6                                |
| `--pref`           | User Preferences, comma separated list. `m` for showing music, `p` for showing pay-per-view, `h` for showing HD | (empty)                          |
| `--country`        | Country code (default: `USA`)                                                                                   | USA                              |
| `--postalCode`     | Postal code of where shows are available.                                                                       | 30309                            |
| `--userAgent`      | Custom user agent string for HTTP requests.                                                                     | Uses random if not specified     |
| `--timezone`       | Timezone                                                                                                        | System default                   |
| `--outputFile`     | Output file name (default: xmltv.xml)                                                                           | xmltv.xml                        |
| `--appendAsterisk` | Add \* after Program name labeled New and/or Live                                                                |                                  |

## Setup and running in intervals

### Running natively

You can run zap2xml natively on your system. It is recommended to use a task scheduler to run it in intervals.

Here are some links to get you started on your machine:

* Linux and Raspberry Pi: https://github.com/jef/zap2xml/wiki/Running-on-Linux-and-Raspberry-Pi
* macOS: https://github.com/jef/zap2xml/wiki/Running-on-macOS
* Windows: https://github.com/jef/zap2xml/wiki/Running-on-Windows

If you want to run zap2xml in intervals, you can use a task scheduler like `cron` on Linux or the Task Scheduler on Windows. Each of the wiki pages above has a section on how to set up zap2xml to run in intervals.

### Running in Docker

You can run zap2xml in a Docker container. The `SLEEP\_TIME` environment variable can be used to set the interval between runs. The default is 21600 seconds (6 hours).

## FAQ

### How do I get my Lineup ID?

Visit https://github.com/jef/zap2xml/wiki/Retrieving-Lineup-ID

