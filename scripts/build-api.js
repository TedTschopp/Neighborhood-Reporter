/**
 * Build API Script
 * 
 * Compiles YAML data files into a static JSON API.
 * This is the main callable API that returns all sources categorized by
 * media type and organization type.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const API_DIR = path.join(ROOT_DIR, 'api', 'v1');

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
 * Load all neighborhoods
 */
async function loadNeighborhoods() {
  const neighborhoodDir = path.join(DATA_DIR, 'neighborhoods');
  const files = await loadYamlFiles(neighborhoodDir);
  
  return files.map(f => f.data).filter(n => n && n.id);
}

/**
 * Load all sources from all category files
 */
async function loadAllSources() {
  const sourcesDir = path.join(DATA_DIR, 'sources');
  const files = await loadYamlFiles(sourcesDir);
  
  const allSources = [];
  for (const { file, data } of files) {
    if (data && data.sources) {
      // Add source file origin for tracking
      const sourcesWithOrigin = data.sources.map(s => ({
        ...s,
        _sourceFile: file.replace('.yaml', '')
      }));
      allSources.push(...sourcesWithOrigin);
    }
  }
  
  return allSources;
}

/**
 * Load all leaders
 */
async function loadLeaders() {
  const leadersDir = path.join(DATA_DIR, 'leaders');
  const files = await loadYamlFiles(leadersDir);
  
  const allLeaders = [];
  for (const { data } of files) {
    if (data && data.leaders) {
      allLeaders.push(...data.leaders);
    }
  }
  
  return allLeaders;
}

/**
 * Group sources by a specific field
 */
function groupBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || 'other';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});
}

/**
 * Get sources for a specific neighborhood
 */
function getSourcesForNeighborhood(sources, neighborhoodId) {
  return sources.filter(source => {
    if (!source.neighborhoods) return false;
    return source.neighborhoods.includes('all') || 
           source.neighborhoods.includes(neighborhoodId);
  });
}

/**
 * Get leaders for a specific neighborhood
 */
function getLeadersForNeighborhood(leaders, neighborhoodId) {
  return leaders.filter(leader => {
    if (!leader.neighborhoods) return false;
    return leader.neighborhoods.includes('all') || 
           leader.neighborhoods.includes(neighborhoodId);
  });
}

/**
 * Build the unified API response for a neighborhood
 * This is the main API endpoint structure
 */
function buildNeighborhoodAPI(neighborhood, sources, leaders) {
  const neighborhoodSources = getSourcesForNeighborhood(sources, neighborhood.id);
  const neighborhoodLeaders = getLeadersForNeighborhood(leaders, neighborhood.id);
  
  // Group sources by category and media type
  const byCategory = groupBy(neighborhoodSources, 'category');
  const byMediaType = groupBy(neighborhoodSources, 'media_type');
  const byOrganizationType = groupBy(neighborhoodSources, 'organization_type');
  const byType = groupBy(neighborhoodSources, 'type');
  
  // Group leaders by organization type
  const leadersByOrgType = groupBy(neighborhoodLeaders, 'organization_type');
  
  return {
    neighborhood: {
      id: neighborhood.id,
      name: neighborhood.name,
      slug: neighborhood.slug,
      region: neighborhood.region,
      city: neighborhood.city,
      state: neighborhood.state,
      zip_codes: neighborhood.zip_codes,
      coordinates: neighborhood.coordinates
    },
    summary: {
      total_sources: neighborhoodSources.length,
      total_leaders: neighborhoodLeaders.length,
      sources_by_category: Object.fromEntries(
        Object.entries(byCategory).map(([k, v]) => [k, v.length])
      ),
      sources_by_media_type: Object.fromEntries(
        Object.entries(byMediaType).map(([k, v]) => [k, v.length])
      )
    },
    sources: {
      all: neighborhoodSources,
      by_category: byCategory,
      by_media_type: byMediaType,
      by_organization_type: byOrganizationType,
      by_fetch_type: byType
    },
    leaders: {
      all: neighborhoodLeaders,
      by_organization_type: leadersByOrgType
    },
    generated_at: new Date().toISOString()
  };
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
  console.log(`✓ Written: ${path.relative(ROOT_DIR, filePath)}`);
}

/**
 * Main build function
 */
async function build() {
  console.log('🏗️  Building Neighborhood Reporter API...\n');
  
  // Load all data
  console.log('📂 Loading data files...');
  const neighborhoods = await loadNeighborhoods();
  const sources = await loadAllSources();
  const leaders = await loadLeaders();
  
  console.log(`   Found ${neighborhoods.length} neighborhoods`);
  console.log(`   Found ${sources.length} sources`);
  console.log(`   Found ${leaders.length} leaders\n`);
  
  // Clean API directory
  await ensureDir(API_DIR);
  
  // Build index
  console.log('📝 Building API endpoints...');
  
  const apiIndex = {
    name: 'Neighborhood Reporter API',
    version: '1.0.0',
    description: 'Local news source aggregation API',
    endpoints: {
      neighborhoods: '/api/v1/neighborhoods/',
      sources: '/api/v1/sources/',
      leaders: '/api/v1/leaders/'
    },
    neighborhoods: neighborhoods.map(n => ({
      id: n.id,
      name: n.name,
      slug: n.slug,
      endpoint: `/api/v1/neighborhoods/${n.id}.json`
    })),
    generated_at: new Date().toISOString()
  };
  
  await writeJson(path.join(API_DIR, 'index.json'), apiIndex);
  
  // Build neighborhood index
  await ensureDir(path.join(API_DIR, 'neighborhoods'));
  await writeJson(
    path.join(API_DIR, 'neighborhoods', 'index.json'),
    {
      neighborhoods: neighborhoods.map(n => ({
        id: n.id,
        name: n.name,
        slug: n.slug,
        region: n.region,
        city: n.city,
        state: n.state,
        active: n.active
      })),
      generated_at: new Date().toISOString()
    }
  );
  
  // Build individual neighborhood endpoints
  for (const neighborhood of neighborhoods) {
    const neighborhoodAPI = buildNeighborhoodAPI(neighborhood, sources, leaders);
    await writeJson(
      path.join(API_DIR, 'neighborhoods', `${neighborhood.id}.json`),
      neighborhoodAPI
    );
  }
  
  // Build sources index and category endpoints
  await ensureDir(path.join(API_DIR, 'sources'));
  await ensureDir(path.join(API_DIR, 'sources', 'by-category'));
  await ensureDir(path.join(API_DIR, 'sources', 'by-media-type'));
  await ensureDir(path.join(API_DIR, 'sources', 'by-type'));
  
  // All sources
  const sourcesIndex = {
    total: sources.length,
    sources: sources,
    by_category: groupBy(sources, 'category'),
    by_media_type: groupBy(sources, 'media_type'),
    by_type: groupBy(sources, 'type'),
    generated_at: new Date().toISOString()
  };
  await writeJson(path.join(API_DIR, 'sources', 'index.json'), sourcesIndex);
  
  // Category endpoints
  const byCategory = groupBy(sources, 'category');
  for (const [category, categorySources] of Object.entries(byCategory)) {
    await writeJson(
      path.join(API_DIR, 'sources', 'by-category', `${category}.json`),
      { category, count: categorySources.length, sources: categorySources }
    );
  }
  
  // Media type endpoints
  const byMediaType = groupBy(sources, 'media_type');
  for (const [mediaType, mediaTypeSources] of Object.entries(byMediaType)) {
    await writeJson(
      path.join(API_DIR, 'sources', 'by-media-type', `${mediaType}.json`),
      { media_type: mediaType, count: mediaTypeSources.length, sources: mediaTypeSources }
    );
  }
  
  // Fetch type endpoints
  const byType = groupBy(sources, 'type');
  for (const [type, typeSources] of Object.entries(byType)) {
    await writeJson(
      path.join(API_DIR, 'sources', 'by-type', `${type}.json`),
      { type, count: typeSources.length, sources: typeSources }
    );
  }
  
  // Build leaders index
  await ensureDir(path.join(API_DIR, 'leaders'));
  
  const leadersIndex = {
    total: leaders.length,
    leaders: leaders.filter(l => l.public_directory !== false),
    by_organization_type: groupBy(
      leaders.filter(l => l.public_directory !== false),
      'organization_type'
    ),
    generated_at: new Date().toISOString()
  };
  await writeJson(path.join(API_DIR, 'leaders', 'index.json'), leadersIndex);
  
  console.log('\n✅ API build complete!');
  console.log(`   Output: ${path.relative(ROOT_DIR, API_DIR)}/`);
}

// Run build
build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
