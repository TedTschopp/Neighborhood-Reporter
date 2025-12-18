/**
 * Generate Newsletter Script
 * 
 * Generates HTML newsletters from aggregated feed data using MJML templates.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mjml2html from 'mjml';
import { format, parseISO, subDays } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const AGGREGATED_DIR = path.join(DATA_DIR, 'aggregated', 'feeds');
const TEMPLATES_DIR = path.join(ROOT_DIR, 'config', 'templates');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output', 'newsletters');

/**
 * Load the latest aggregated data
 */
async function loadLatestData() {
  try {
    // Try to load the latest.json pointer
    const latestPath = path.join(AGGREGATED_DIR, 'latest.json');
    const latestContent = await fs.readFile(latestPath, 'utf8');
    const latest = JSON.parse(latestContent);
    
    // Load the actual aggregated data
    const aggregatedPath = path.join(AGGREGATED_DIR, latest.date, 'aggregated.json');
    const aggregatedContent = await fs.readFile(aggregatedPath, 'utf8');
    return JSON.parse(aggregatedContent);
  } catch (error) {
    console.log('⚠️  No aggregated data found. Run `npm run fetch` first.');
    return null;
  }
}

/**
 * Load MJML template
 */
async function loadTemplate(templateName) {
  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.mjml`);
  return await fs.readFile(templatePath, 'utf8');
}

/**
 * Group items by category
 */
function groupByCategory(items) {
  const groups = {
    municipal: [],
    media: [],
    civic: [],
    educational: [],
    religious: [],
    corporate: [],
    social: [],
    other: []
  };
  
  for (const item of items) {
    const category = item.category || 'other';
    if (groups[category]) {
      groups[category].push(item);
    } else {
      groups.other.push(item);
    }
  }
  
  return groups;
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return format(date, 'MMM d, yyyy');
  } catch {
    return '';
  }
}

/**
 * Simple template variable replacement
 * (In production, use Handlebars or similar)
 */
function renderTemplate(template, data) {
  let result = template;
  
  // Replace simple variables
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
  
  // Handle conditionals {{#if variable}}...{{/if}}
  result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
    const value = data[key];
    if (value && (Array.isArray(value) ? value.length > 0 : true)) {
      return content;
    }
    return '';
  });
  
  // Handle each loops {{#each variable}}...{{/each}}
  result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, key, content) => {
    const items = data[key];
    if (!Array.isArray(items) || items.length === 0) {
      return '';
    }
    
    return items.map(item => {
      let itemContent = content;
      // Replace {{this.property}} patterns
      itemContent = itemContent.replace(/\{\{this\.(\w+)\}\}/g, (m, prop) => {
        return item[prop] !== undefined ? item[prop] : '';
      });
      // Handle nested conditionals
      itemContent = itemContent.replace(/\{\{#if this\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, prop, c) => {
        return item[prop] ? c.replace(/\{\{this\.(\w+)\}\}/g, (mm, p) => item[p] || '') : '';
      });
      return itemContent;
    }).join('');
  });
  
  return result;
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
 * Truncate text to a maximum length
 */
function truncate(text, maxLength = 200) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Generate newsletter for a specific neighborhood
 */
async function generateNewsletter(neighborhoodName = 'All Neighborhoods', items, options = {}) {
  console.log(`\n📧 Generating newsletter for ${neighborhoodName}...`);
  
  // Load template
  const template = await loadTemplate('newsletter');
  
  // Group items by category
  const grouped = groupByCategory(items);
  
  // Prepare items with formatted dates
  const prepareItems = (categoryItems, limit = 10) => {
    return categoryItems
      .slice(0, limit)
      .map(item => ({
        ...item,
        date_formatted: formatDate(item.published_at),
        summary: truncate(item.summary, 200)
      }));
  };
  
  // Prepare template data
  const templateData = {
    title: `${neighborhoodName} News Digest`,
    preview: `Your weekly local news roundup - ${items.length} stories from your community`,
    neighborhood_name: neighborhoodName,
    date_formatted: format(new Date(), 'MMMM d, yyyy'),
    item_count: items.length,
    source_count: new Set(items.map(i => i.source_id)).size,
    generated_at: format(new Date(), 'PPpp'),
    unsubscribe_url: '#unsubscribe',
    preferences_url: '#preferences',
    
    // Category items
    municipal_items: prepareItems(grouped.municipal),
    media_items: prepareItems(grouped.media),
    civic_items: prepareItems(grouped.civic),
    educational_items: prepareItems(grouped.educational),
    other_items: prepareItems([
      ...grouped.religious,
      ...grouped.corporate,
      ...grouped.social,
      ...grouped.other
    ])
  };
  
  // Render template with data
  const renderedMjml = renderTemplate(template, templateData);
  
  // Compile MJML to HTML
  const { html, errors } = mjml2html(renderedMjml, {
    validationLevel: 'soft',
    minify: false
  });
  
  if (errors && errors.length > 0) {
    console.log('   ⚠️  MJML warnings:');
    errors.forEach(err => console.log(`      - ${err.message}`));
  }
  
  return html;
}

/**
 * Main generate function
 */
async function generate() {
  console.log('📰 Generating Neighborhood Reporter Newsletter...\n');
  
  // Load aggregated data
  const data = await loadLatestData();
  
  if (!data) {
    console.log('No data to generate newsletter from.');
    console.log('Run `npm run fetch` to collect news first.');
    process.exit(1);
  }
  
  console.log(`📅 Using data from: ${data.date}`);
  console.log(`📊 Total items: ${data.items.length}`);
  
  // Filter items from the last 7 days
  const weekAgo = subDays(new Date(), 7);
  const recentItems = data.items.filter(item => {
    if (!item.published_at) return true; // Include items without dates
    try {
      const pubDate = parseISO(item.published_at);
      return pubDate >= weekAgo;
    } catch {
      return true;
    }
  });
  
  console.log(`📋 Items from last 7 days: ${recentItems.length}`);
  
  // Generate newsletter
  const html = await generateNewsletter('Your Neighborhood', recentItems);
  
  // Save newsletter
  await ensureDir(OUTPUT_DIR);
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const outputPath = path.join(OUTPUT_DIR, `newsletter-${dateStr}.html`);
  await fs.writeFile(outputPath, html);
  
  // Also save as latest
  await fs.writeFile(path.join(OUTPUT_DIR, 'latest.html'), html);
  
  console.log('\n✅ Newsletter generated!');
  console.log(`   Output: ${path.relative(ROOT_DIR, outputPath)}`);
  console.log(`   Latest: ${path.relative(ROOT_DIR, path.join(OUTPUT_DIR, 'latest.html'))}`);
}

// Run generate
generate().catch(err => {
  console.error('❌ Newsletter generation failed:', err);
  process.exit(1);
});
