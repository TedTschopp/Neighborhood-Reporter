# Neighborhood Reporter

A static-file-based API and newsletter system that consolidates local news sources for any neighborhood. Human-editable YAML files define sources across social, civic, corporate, religious, educational, and municipal categories.

## Features

- **Multi-source Aggregation**: Pull news from RSS feeds, social media, newsletters, TV, and radio sources
- **Categorized Sources**: Organize by type (social, civic, corporate, religious, educational, municipal, media)
- **Leader Tracking**: Track organizational leaders and their contact information
- **Static JSON API**: No database required - all data stored in human-readable YAML files
- **Newsletter Generation**: Automatically generate HTML newsletters from aggregated content
- **GitHub Actions**: Automated daily fetching and deployment

## Quick Start

```bash
# Install dependencies
npm install

# Validate all data files
npm run validate

# Build the API
npm run build:api

# Fetch latest news from all sources
npm run fetch

# Generate newsletter
npm run build:newsletter

# Start local development server
npm run dev
```

## Project Structure

```
neighborhood-reporter/
├── data/
│   ├── neighborhoods/       # Neighborhood definitions (YAML)
│   │   ├── _schema.json     # JSON Schema for validation
│   │   └── *.yaml           # One file per neighborhood
│   ├── sources/             # News source definitions (YAML)
│   │   ├── _schema.json
│   │   ├── civic.yaml
│   │   ├── corporate.yaml
│   │   ├── educational.yaml
│   │   ├── media.yaml
│   │   ├── municipal.yaml
│   │   ├── religious.yaml
│   │   └── social.yaml
│   ├── leaders/             # Organizational leaders (YAML)
│   │   ├── _schema.json
│   │   └── contacts.yaml
│   └── aggregated/          # Fetched/cached content
│       └── feeds/
├── api/                     # Generated JSON API output
│   └── v1/
│       ├── index.json
│       ├── neighborhoods/
│       ├── sources/
│       └── leaders/
├── scripts/
│   ├── build-api.js         # Compile YAML → JSON API
│   ├── fetch-feeds.js       # RSS/feed fetcher
│   ├── generate-newsletter.js
│   └── validate-data.js
├── config/
│   └── templates/
│       └── newsletter.mjml
├── web/                     # Static website
└── .github/
    └── workflows/
```

## Data Files

### Adding a Neighborhood

Create a new file in `data/neighborhoods/`:

```yaml
# data/neighborhoods/highland-park.yaml
id: highland-park
name: Highland Park
slug: highland-park
region: Northeast Los Angeles
zip_codes:
  - "90042"
  - "90065"
coordinates:
  latitude: 34.1122
  longitude: -118.1928
council_district: "1"
active: true
```

### Adding a News Source

Add to the appropriate category file in `data/sources/`:

```yaml
# In data/sources/media.yaml
sources:
  - id: laist
    name: LAist
    type: rss
    category: local-news
    media_type: online
    url: https://laist.com/
    feed_url: https://laist.com/rss/index.xml
    neighborhoods:
      - all
    reliability_score: 9
    frequency: daily
    active: true
```

### Adding a Leader

Add to `data/leaders/contacts.yaml`:

```yaml
leaders:
  - id: cd1-council-member
    name: Council Member Name
    role: City Council Representative
    organization: Los Angeles City Council
    organization_type: municipal
    neighborhoods:
      - highland-park
      - eagle-rock
    contact:
      email: councilmember@lacity.org
      website: https://cd1.lacity.org
    social:
      twitter: "@cd1rep"
    active: true
```

## API Endpoints

After running `npm run build:api`, the following JSON files are generated:

| Endpoint | Description |
|----------|-------------|
| `/api/v1/index.json` | API overview and available endpoints |
| `/api/v1/neighborhoods/index.json` | List of all neighborhoods |
| `/api/v1/neighborhoods/{id}.json` | Single neighborhood with its sources |
| `/api/v1/sources/index.json` | All sources grouped by category |
| `/api/v1/sources/by-type/{type}.json` | Sources filtered by media type |
| `/api/v1/sources/by-category/{cat}.json` | Sources filtered by category |
| `/api/v1/leaders/index.json` | All organizational leaders |

## Source Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `social` | Social media sources | Nextdoor, Facebook groups, Twitter lists |
| `civic` | Community organizations | Neighborhood councils, civic associations |
| `corporate` | Large local businesses | Corporate newsrooms, business announcements |
| `religious` | Religious organizations | Churches, temples, mosques |
| `educational` | Schools and universities | School districts, colleges, PTAs |
| `municipal` | Government sources | City council, police, fire, transit |
| `media` | Traditional media | Newspapers, TV stations, radio, podcasts |

## Media Types

- `rss` - RSS/Atom feeds
- `api` - JSON/REST APIs
- `scrape` - Web scraping (use sparingly)
- `social` - Social media platforms
- `newsletter` - Email newsletters
- `broadcast` - TV/Radio stations

## GitHub Actions

The project includes workflows for:

- **Daily Feed Fetch**: Runs every morning to pull latest content
- **API Build**: Rebuilds JSON API when data files change
- **Newsletter Generation**: Weekly newsletter compilation

## License

MIT
