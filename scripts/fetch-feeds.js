/**
 * Fetch Feeds Script
 * 
 * Fetches content from RSS feeds and other sources defined in the data files.
 * Stores aggregated content in data/aggregated/feeds/ for newsletter generation.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import Parser from 'rss-parser';
import { format } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const AGGREGATED_DIR = path.join(DATA_DIR, 'aggregated', 'feeds');

// RSS Parser with custom fields
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['media:thumbnail', 'thumbnail'],
      ['dc:creator', 'creator'],
      ['content:encoded', 'contentEncoded']
    ]
  },
  timeout: 10000
});

/**
 * Load all YAML files from a directory
 */
async function loadYamlFiles(dirPath) {
  const files = await fs.readdir(dirPath);
  const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  
  const data = [];
  for (const file of yamlFiles) {
    const filePath = path.join(dirPath, file);
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = yaml.load(content);
    data.push({ file, data: parsed });
  }
  
  return data;
}

/**
 * Load all sources that can be fetched
 */
async function loadFetchableSources() {
  const sourcesDir = path.join(DATA_DIR, 'sources');
  const files = await loadYamlFiles(sourcesDir);
  
  const fetchable = [];
  for (const { data } of files) {
    if (data && data.sources) {
      const rssFeeds = data.sources.filter(s => 
        s.active && 
        s.type === 'rss' && 
        s.feed_url
      );
      fetchable.push(...rssFeeds);
    }
  }
  
  return fetchable;
}

/**
 * Fetch a single RSS feed
 */
async function fetchFeed(source) {
  console.log(`   Fetching: ${source.name}...`);
  
  try {
    const feed = await parser.parseURL(source.feed_url);
    
    const items = feed.items.map(item => ({
      id: generateItemId(source.id, item.link || item.guid),
      source_id: source.id,
      source_name: source.name,
      category: source.category,
      media_type: source.media_type,
      neighborhoods: source.neighborhoods,
      title: item.title,
      url: item.link,
      guid: item.guid || item.link,
      published_at: item.pubDate || item.isoDate,
      author: item.creator || item.author,
      summary: item.contentSnippet || item.content?.substring(0, 500),
      content: item.contentEncoded || item.content,
      image_url: extractImageUrl(item),
      categories: item.categories || [],
      fetched_at: new Date().toISOString()
    }));
    
    console.log(`   ✓ ${source.name}: ${items.length} items`);
    
    return {
      source_id: source.id,
      source_name: source.name,
      feed_title: feed.title,
      feed_url: source.feed_url,
      fetched_at: new Date().toISOString(),
      item_count: items.length,
      items
    };
  } catch (error) {
    console.log(`   ✗ ${source.name}: ${error.message}`);
    return {
      source_id: source.id,
      source_name: source.name,
      feed_url: source.feed_url,
      fetched_at: new Date().toISOString(),
      error: error.message,
      items: []
    };
  }
}

/**
 * Generate a unique ID for a feed item
 */
function generateItemId(sourceId, url) {
  const hash = url
    .split('')
    .reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
    .toString(16);
  return `${sourceId}-${hash}`;
}

/**
 * Extract image URL from feed item
 */
function extractImageUrl(item) {
  if (item.media && item.media.$) {
    return item.media.$.url;
  }
  if (item.thumbnail && item.thumbnail.$) {
    return item.thumbnail.$.url;
  }
  if (item.enclosure && item.enclosure.type?.startsWith('image/')) {
    return item.enclosure.url;
  }
  return null;
}

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

/**
 * Write JSON file
 */
async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Delay utility for rate limiting
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main fetch function
 */
async function fetchAll() {
  console.log('📡 Fetching news feeds...\n');
  
  // Load fetchable sources
  const sources = await loadFetchableSources();
  console.log(`📰 Found ${sources.length} RSS sources to fetch\n`);
  
  if (sources.length === 0) {
    console.log('No RSS sources configured. Add sources with type: rss and feed_url.');
    return;
  }
  
  // Fetch all feeds with rate limiting
  const results = [];
  const errors = [];
  
  for (const source of sources) {
    const result = await fetchFeed(source);
    
    if (result.error) {
      errors.push(result);
    } else {
      results.push(result);
    }
    
    // Rate limit: wait 500ms between requests
    await delay(500);
  }
  
  // Aggregate all items
  const allItems = results.flatMap(r => r.items);
  
  // Sort by publication date (newest first)
  allItems.sort((a, b) => {
    const dateA = new Date(a.published_at || 0);
    const dateB = new Date(b.published_at || 0);
    return dateB - dateA;
  });
  
  // Deduplicate by URL
  const seenUrls = new Set();
  const uniqueItems = allItems.filter(item => {
    if (seenUrls.has(item.url)) {
      return false;
    }
    seenUrls.add(item.url);
    return true;
  });
  
  // Create dated output directory
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const outputDir = path.join(AGGREGATED_DIR, dateStr);
  
  // Write aggregated data
  const aggregated = {
    fetched_at: new Date().toISOString(),
    date: dateStr,
    summary: {
      total_sources: sources.length,
      successful_fetches: results.length,
      failed_fetches: errors.length,
      total_items: uniqueItems.length,
      items_by_category: groupAndCount(uniqueItems, 'category'),
      items_by_source: groupAndCount(uniqueItems, 'source_name')
    },
    items: uniqueItems,
    sources: results,
    errors: errors.map(e => ({
      source_id: e.source_id,
      source_name: e.source_name,
      error: e.error
    }))
  };
  
  await writeJson(path.join(outputDir, 'aggregated.json'), aggregated);
  
  // Write separate file for just the items (for easy newsletter generation)
  await writeJson(path.join(outputDir, 'items.json'), {
    date: dateStr,
    count: uniqueItems.length,
    items: uniqueItems
  });
  
  // Write a "latest" symlink-like file
  await writeJson(path.join(AGGREGATED_DIR, 'latest.json'), {
    date: dateStr,
    path: `./${dateStr}/aggregated.json`
  });
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Fetch Summary');
  console.log('='.repeat(50));
  console.log(`   Sources fetched: ${results.length}/${sources.length}`);
  console.log(`   Items collected: ${uniqueItems.length}`);
  console.log(`   Errors: ${errors.length}`);
  console.log(`   Output: ${path.relative(ROOT_DIR, outputDir)}/`);
  console.log('='.repeat(50));
  
  if (errors.length > 0) {
    console.log('\n⚠️  Some feeds failed to fetch:');
    errors.forEach(e => console.log(`   - ${e.source_name}: ${e.error}`));
  }
  
  console.log('\n✅ Fetch complete!');
}

/**
 * Group items and count by field
 */
function groupAndCount(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

// Run fetch
fetchAll().catch(err => {
  console.error('❌ Fetch failed:', err);
  process.exit(1);
});
