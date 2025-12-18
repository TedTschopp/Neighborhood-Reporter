#!/usr/bin/env node

/**
 * Social Media Profile Scanner
 * 
 * Scans social media platforms for profiles related to organizations
 * and leaders already defined in the Neighborhood Reporter data.
 * 
 * Based on platform patterns from github.com/TedTschopp/user-scanner
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Platform definitions with URL patterns for profile lookup
const PLATFORMS = {
  // Social Media
  twitter: {
    name: 'X (Twitter)',
    profileUrl: 'https://x.com/{username}',
    searchUrl: 'https://x.com/search?q={query}',
    category: 'social'
  },
  facebook: {
    name: 'Facebook',
    profileUrl: 'https://facebook.com/{username}',
    searchUrl: 'https://facebook.com/search/pages?q={query}',
    category: 'social'
  },
  instagram: {
    name: 'Instagram',
    profileUrl: 'https://instagram.com/{username}',
    searchUrl: null, // No public search
    category: 'social'
  },
  youtube: {
    name: 'YouTube',
    profileUrl: 'https://youtube.com/@{username}',
    searchUrl: 'https://youtube.com/results?search_query={query}',
    category: 'social'
  },
  linkedin: {
    name: 'LinkedIn',
    profileUrl: 'https://linkedin.com/company/{username}',
    searchUrl: 'https://linkedin.com/search/results/companies/?keywords={query}',
    category: 'social'
  },
  threads: {
    name: 'Threads',
    profileUrl: 'https://threads.net/@{username}',
    searchUrl: null,
    category: 'social'
  },
  bluesky: {
    name: 'Bluesky',
    profileUrl: 'https://bsky.app/profile/{username}.bsky.social',
    searchUrl: 'https://bsky.app/search?q={query}',
    category: 'social'
  },
  mastodon: {
    name: 'Mastodon',
    profileUrl: 'https://mastodon.social/@{username}',
    searchUrl: null,
    category: 'social'
  },
  tiktok: {
    name: 'TikTok',
    profileUrl: 'https://tiktok.com/@{username}',
    searchUrl: 'https://tiktok.com/search?q={query}',
    category: 'social'
  },
  reddit: {
    name: 'Reddit',
    profileUrl: 'https://reddit.com/user/{username}',
    subredditUrl: 'https://reddit.com/r/{subreddit}',
    searchUrl: 'https://reddit.com/search?q={query}',
    category: 'social'
  },
  nextdoor: {
    name: 'Nextdoor',
    profileUrl: null, // Private network
    searchUrl: null,
    category: 'social'
  },
  discord: {
    name: 'Discord',
    profileUrl: null, // Invite-based
    searchUrl: null,
    category: 'social'
  },
  telegram: {
    name: 'Telegram',
    profileUrl: 'https://t.me/{username}',
    searchUrl: null,
    category: 'social'
  },
  pinterest: {
    name: 'Pinterest',
    profileUrl: 'https://pinterest.com/{username}',
    searchUrl: 'https://pinterest.com/search/users/?q={query}',
    category: 'social'
  },
  snapchat: {
    name: 'Snapchat',
    profileUrl: 'https://snapchat.com/@{username}',
    searchUrl: null,
    category: 'social'
  },
  
  // Developer Platforms
  github: {
    name: 'GitHub',
    profileUrl: 'https://github.com/{username}',
    searchUrl: 'https://github.com/search?q={query}&type=users',
    category: 'developer'
  },
  gitlab: {
    name: 'GitLab',
    profileUrl: 'https://gitlab.com/{username}',
    searchUrl: null,
    category: 'developer'
  },
  
  // Content Platforms
  medium: {
    name: 'Medium',
    profileUrl: 'https://medium.com/@{username}',
    searchUrl: 'https://medium.com/search?q={query}',
    category: 'content'
  },
  substack: {
    name: 'Substack',
    profileUrl: 'https://{username}.substack.com',
    searchUrl: 'https://substack.com/search/{query}',
    category: 'content'
  },
  
  // Streaming
  twitch: {
    name: 'Twitch',
    profileUrl: 'https://twitch.tv/{username}',
    searchUrl: 'https://twitch.tv/search?term={query}',
    category: 'streaming'
  },
  soundcloud: {
    name: 'SoundCloud',
    profileUrl: 'https://soundcloud.com/{username}',
    searchUrl: 'https://soundcloud.com/search/people?q={query}',
    category: 'streaming'
  },
  
  // Crowdfunding
  patreon: {
    name: 'Patreon',
    profileUrl: 'https://patreon.com/{username}',
    searchUrl: 'https://patreon.com/search?q={query}',
    category: 'crowdfunding'
  },
  gofundme: {
    name: 'GoFundMe',
    profileUrl: null,
    searchUrl: 'https://gofundme.com/s?q={query}',
    category: 'crowdfunding'
  },
  buymeacoffee: {
    name: 'Buy Me a Coffee',
    profileUrl: 'https://buymeacoffee.com/{username}',
    searchUrl: null,
    category: 'crowdfunding'
  },
  
  // Review/Directory
  yelp: {
    name: 'Yelp',
    profileUrl: 'https://yelp.com/biz/{slug}',
    searchUrl: 'https://yelp.com/search?find_desc={query}&find_loc=Duarte,+CA',
    category: 'directory'
  },
  google_business: {
    name: 'Google Business',
    profileUrl: null,
    searchUrl: 'https://google.com/search?q={query}+Duarte+CA',
    category: 'directory'
  }
};

/**
 * Load all sources from YAML files
 */
function loadSources() {
  const sourcesDir = path.join(rootDir, 'data', 'sources');
  const sources = [];
  
  const files = fs.readdirSync(sourcesDir).filter(f => 
    f.endsWith('.yaml') && !f.startsWith('_')
  );
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(sourcesDir, file), 'utf8');
    const data = yaml.load(content);
    if (data?.sources) {
      sources.push(...data.sources);
    }
  }
  
  return sources;
}

/**
 * Load all leaders from YAML files
 */
function loadLeaders() {
  const leadersDir = path.join(rootDir, 'data', 'leaders');
  const leaders = [];
  
  const files = fs.readdirSync(leadersDir).filter(f => 
    f.endsWith('.yaml') && !f.startsWith('_')
  );
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(leadersDir, file), 'utf8');
    const data = yaml.load(content);
    if (data?.leaders) {
      leaders.push(...data.leaders);
    }
  }
  
  return leaders;
}

/**
 * Extract unique organizations from sources and leaders
 */
function extractOrganizations(sources, leaders) {
  const orgs = new Map();
  
  // From sources
  for (const source of sources) {
    if (source.organization && source.organization_type !== 'media') {
      const key = source.organization.toLowerCase();
      if (!orgs.has(key)) {
        orgs.set(key, {
          name: source.organization,
          type: source.organization_type,
          existingSocial: []
        });
      }
      // Track existing social handles
      if (source.social_platform) {
        orgs.get(key).existingSocial.push({
          platform: source.social_platform,
          url: source.url,
          handle: source.social_handle
        });
      }
    }
  }
  
  // From leaders
  for (const leader of leaders) {
    if (leader.organization) {
      const key = leader.organization.toLowerCase();
      if (!orgs.has(key)) {
        orgs.set(key, {
          name: leader.organization,
          type: leader.organization_type,
          existingSocial: []
        });
      }
    }
  }
  
  return Array.from(orgs.values());
}

/**
 * Generate search terms for an organization
 */
function generateSearchTerms(org) {
  const terms = [org.name];
  
  // Add variations
  const name = org.name;
  
  // Remove common suffixes for variations
  const variations = [
    name.replace(/\s+(Inc|LLC|Corp|Corporation|Company)\.?$/i, ''),
    name.replace(/^(The|City of|County of)\s+/i, ''),
  ].filter(v => v !== name && v.length > 3);
  
  terms.push(...variations);
  
  return [...new Set(terms)];
}

/**
 * Generate potential social media profile URLs for an organization
 */
function generatePotentialProfiles(org) {
  const profiles = [];
  const searchTerms = generateSearchTerms(org);
  
  // Generate username guesses
  const usernameGuesses = searchTerms.map(term => 
    term.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '')
  ).filter(u => u.length >= 3);
  
  // Add variations with underscores and dashes
  const allUsernames = new Set(usernameGuesses);
  searchTerms.forEach(term => {
    allUsernames.add(term.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_'));
    allUsernames.add(term.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-'));
  });
  
  // Check which platforms we already have
  const existingPlatforms = new Set(org.existingSocial.map(s => s.platform));
  
  for (const [platformKey, platform] of Object.entries(PLATFORMS)) {
    // Skip if we already have this platform
    if (existingPlatforms.has(platformKey)) continue;
    
    // Generate potential profile URLs
    if (platform.profileUrl) {
      for (const username of allUsernames) {
        profiles.push({
          platform: platformKey,
          platformName: platform.name,
          url: platform.profileUrl.replace('{username}', username),
          username,
          status: 'unchecked'
        });
      }
    }
    
    // Add search URL for manual verification
    if (platform.searchUrl) {
      profiles.push({
        platform: platformKey,
        platformName: platform.name,
        url: platform.searchUrl.replace('{query}', encodeURIComponent(org.name)),
        type: 'search',
        status: 'unchecked'
      });
    }
  }
  
  return profiles;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Social Media Profile Scanner\n');
  console.log('Loading data...\n');
  
  const sources = loadSources();
  const leaders = loadLeaders();
  const organizations = extractOrganizations(sources, leaders);
  
  console.log(`Found ${organizations.length} unique organizations\n`);
  console.log('=' .repeat(60) + '\n');
  
  // Group by organization type
  const byType = {};
  for (const org of organizations) {
    const type = org.type || 'other';
    if (!byType[type]) byType[type] = [];
    byType[type].push(org);
  }
  
  // Output report
  const report = {
    generated: new Date().toISOString(),
    summary: {
      totalOrganizations: organizations.length,
      byType: {}
    },
    organizations: []
  };
  
  for (const [type, orgs] of Object.entries(byType)) {
    report.summary.byType[type] = orgs.length;
    console.log(`\n## ${type.toUpperCase()} (${orgs.length} organizations)\n`);
    
    for (const org of orgs.slice(0, 5)) { // Limit output for demo
      console.log(`### ${org.name}`);
      
      if (org.existingSocial.length > 0) {
        console.log('  Existing social profiles:');
        org.existingSocial.forEach(s => {
          console.log(`    - ${s.platform}: ${s.url}`);
        });
      }
      
      const potentialProfiles = generatePotentialProfiles(org);
      const searchUrls = potentialProfiles.filter(p => p.type === 'search');
      
      if (searchUrls.length > 0) {
        console.log('  Search URLs to find profiles:');
        searchUrls.slice(0, 3).forEach(p => {
          console.log(`    - ${p.platformName}: ${p.url}`);
        });
      }
      
      report.organizations.push({
        name: org.name,
        type: org.type,
        existingSocial: org.existingSocial,
        potentialProfiles: potentialProfiles.slice(0, 20) // Limit for report
      });
      
      console.log('');
    }
    
    if (orgs.length > 5) {
      console.log(`  ... and ${orgs.length - 5} more organizations\n`);
    }
  }
  
  // Save report
  const reportPath = path.join(rootDir, 'output', 'social-scan-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('=' .repeat(60));
  console.log(`\n✅ Report saved to: ${reportPath}`);
  console.log('\nPlatforms supported for scanning:');
  
  const platformsByCategory = {};
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    const cat = platform.category;
    if (!platformsByCategory[cat]) platformsByCategory[cat] = [];
    platformsByCategory[cat].push(platform.name);
  }
  
  for (const [cat, platforms] of Object.entries(platformsByCategory)) {
    console.log(`  ${cat}: ${platforms.join(', ')}`);
  }
}

main().catch(console.error);
