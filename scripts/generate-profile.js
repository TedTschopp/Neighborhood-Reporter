/**
 * Generate Neighborhood Profile Script
 * 
 * Creates a comprehensive markdown profile for each neighborhood
 * based on all collected data (sources, leaders, etc.)
 * 
 * Output: /output/profiles/{neighborhood-id}-profile.md
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output', 'profiles');

/**
 * Load all YAML files from a directory
 */
async function loadYamlFiles(dirPath) {
  const files = await fs.readdir(dirPath);
  const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  
  const data = [];
  for (const file of yamlFiles) {
    if (file.startsWith('_')) continue; // Skip schema files
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
 * Load all sources
 */
async function loadAllSources() {
  const sourcesDir = path.join(DATA_DIR, 'sources');
  const files = await loadYamlFiles(sourcesDir);
  
  const allSources = [];
  for (const { file, data } of files) {
    if (data && data.sources) {
      allSources.push(...data.sources);
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
 * Filter sources for a specific neighborhood
 */
function getSourcesForNeighborhood(sources, neighborhoodId) {
  return sources.filter(s => 
    s.neighborhoods && 
    (s.neighborhoods.includes(neighborhoodId) || s.neighborhoods.includes('all'))
  );
}

/**
 * Filter leaders for a specific neighborhood
 */
function getLeadersForNeighborhood(leaders, neighborhoodId) {
  return leaders.filter(l => 
    l.neighborhoods && 
    (l.neighborhoods.includes(neighborhoodId) || l.neighborhoods.includes('all'))
  );
}

/**
 * Group sources by category
 */
function groupByCategory(sources) {
  const groups = {};
  for (const source of sources) {
    const category = source.category || 'other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(source);
  }
  return groups;
}

/**
 * Group leaders by organization type
 */
function groupLeadersByOrgType(leaders) {
  const groups = {};
  for (const leader of leaders) {
    const orgType = leader.organization_type || 'other';
    if (!groups[orgType]) {
      groups[orgType] = [];
    }
    groups[orgType].push(leader);
  }
  return groups;
}

/**
 * Format a source as markdown
 */
function formatSource(source) {
  let md = `- **[${source.name}](${source.url || '#'})**`;
  
  if (source.organization && source.organization !== source.name) {
    md += ` - ${source.organization}`;
  }
  
  if (source.contact) {
    const contactParts = [];
    if (source.contact.phone) contactParts.push(`📞 ${source.contact.phone}`);
    if (source.contact.office_address) contactParts.push(`📍 ${source.contact.office_address}`);
    if (contactParts.length > 0) {
      md += `\n  - ${contactParts.join(' | ')}`;
    }
  }
  
  if (source.notes) {
    md += `\n  - *${source.notes}*`;
  }
  
  return md;
}

/**
 * Format a leader as markdown
 */
function formatLeader(leader) {
  let md = `- **${leader.name}** - ${leader.role}`;
  
  if (leader.organization) {
    md += ` (${leader.organization})`;
  }
  
  const contactParts = [];
  if (leader.contact) {
    if (leader.contact.phone) contactParts.push(`📞 ${leader.contact.phone}`);
    if (leader.contact.office_address) contactParts.push(`📍 ${leader.contact.office_address}`);
    if (leader.contact.website) contactParts.push(`🌐 [Website](${leader.contact.website})`);
  }
  
  if (leader.social) {
    if (leader.social.twitter) contactParts.push(`🐦 ${leader.social.twitter}`);
    if (leader.social.facebook) contactParts.push(`📘 [Facebook](${leader.social.facebook})`);
  }
  
  if (contactParts.length > 0) {
    md += `\n  - ${contactParts.join(' | ')}`;
  }
  
  if (leader.notes) {
    md += `\n  - *${leader.notes}*`;
  }
  
  return md;
}

/**
 * Get category display name
 */
function getCategoryDisplayName(category) {
  const names = {
    'social': '🌐 Social Media & Community',
    'civic': '🏛️ Civic Organizations',
    'corporate': '🏢 Businesses & Corporations',
    'religious': '⛪ Religious Organizations',
    'educational': '🎓 Educational Institutions',
    'municipal': '🏙️ Municipal & Government',
    'media': '📰 News & Media',
    'local-news': '📰 Local News',
    'hyperlocal': '📍 Hyperlocal',
    'public-safety': '🚨 Public Safety',
    'events': '📅 Events',
    'business': '💼 Business',
    'other': '📋 Other'
  };
  return names[category] || `📋 ${category.charAt(0).toUpperCase() + category.slice(1)}`;
}

/**
 * Get organization type display name
 */
function getOrgTypeDisplayName(orgType) {
  const names = {
    'government': '🏛️ Government Officials',
    'nonprofit': '💚 Nonprofit Leaders',
    'business': '💼 Business Leaders',
    'religious': '⛪ Religious Leaders',
    'educational': '🎓 Education Leaders',
    'media': '📰 Media Contacts',
    'community': '🤝 Community Leaders',
    'civic': '🏛️ Civic Leaders'
  };
  return names[orgType] || `📋 ${orgType.charAt(0).toUpperCase() + orgType.slice(1)}`;
}

/**
 * Generate markdown profile for a neighborhood
 */
function generateProfile(neighborhood, sources, leaders) {
  const neighborhoodSources = getSourcesForNeighborhood(sources, neighborhood.id);
  const neighborhoodLeaders = getLeadersForNeighborhood(leaders, neighborhood.id);
  
  const sourcesByCategory = groupByCategory(neighborhoodSources);
  const leadersByOrgType = groupLeadersByOrgType(neighborhoodLeaders);
  
  const generatedDate = new Date().toISOString().split('T')[0];
  
  let md = `# ${neighborhood.name} Neighborhood Profile

> **Generated:** ${generatedDate}  
> **Sources:** ${neighborhoodSources.length} | **Leaders:** ${neighborhoodLeaders.length}

---

## 📍 Overview

`;

  // Basic Info
  if (neighborhood.description) {
    md += `${neighborhood.description.trim()}\n\n`;
  }

  md += `| Attribute | Value |
|-----------|-------|
| **Location** | ${neighborhood.city || neighborhood.name}, ${neighborhood.state || 'CA'} |
| **ZIP Code(s)** | ${(neighborhood.zip_codes || []).join(', ') || 'N/A'} |
| **Region** | ${neighborhood.region || 'N/A'} |
| **Population** | ${neighborhood.population ? neighborhood.population.toLocaleString() : 'N/A'} |
| **School District** | ${neighborhood.school_district || 'N/A'} |
| **Police** | ${neighborhood.police_division || 'N/A'} |
| **Fire** | ${neighborhood.fire_district || 'N/A'} |
`;

  // Boundaries
  if (neighborhood.boundaries) {
    md += `
### Boundaries

| Direction | Border |
|-----------|--------|
| **North** | ${neighborhood.boundaries.north || 'N/A'} |
| **South** | ${neighborhood.boundaries.south || 'N/A'} |
| **East** | ${neighborhood.boundaries.east || 'N/A'} |
| **West** | ${neighborhood.boundaries.west || 'N/A'} |
`;
  }

  // Coordinates
  if (neighborhood.coordinates) {
    md += `
### Coordinates

📍 [${neighborhood.coordinates.latitude}, ${neighborhood.coordinates.longitude}](https://www.google.com/maps?q=${neighborhood.coordinates.latitude},${neighborhood.coordinates.longitude})

`;
  }

  md += `---

## 👥 Key Leaders & Contacts

`;

  // Leaders by organization type
  const orgTypeOrder = ['government', 'educational', 'civic', 'business', 'religious', 'nonprofit', 'community', 'media'];
  
  for (const orgType of orgTypeOrder) {
    if (leadersByOrgType[orgType] && leadersByOrgType[orgType].length > 0) {
      md += `### ${getOrgTypeDisplayName(orgType)}\n\n`;
      for (const leader of leadersByOrgType[orgType]) {
        md += `${formatLeader(leader)}\n`;
      }
      md += '\n';
    }
  }
  
  // Any remaining org types not in the order
  for (const orgType of Object.keys(leadersByOrgType)) {
    if (!orgTypeOrder.includes(orgType) && leadersByOrgType[orgType].length > 0) {
      md += `### ${getOrgTypeDisplayName(orgType)}\n\n`;
      for (const leader of leadersByOrgType[orgType]) {
        md += `${formatLeader(leader)}\n`;
      }
      md += '\n';
    }
  }

  if (neighborhoodLeaders.length === 0) {
    md += `*No leaders currently listed for this neighborhood.*\n\n`;
  }

  md += `---

## 📰 Information Sources

`;

  // Sources by category
  const categoryOrder = ['municipal', 'civic', 'educational', 'media', 'social', 'corporate', 'religious', 'public-safety', 'events', 'business', 'other'];
  
  for (const category of categoryOrder) {
    if (sourcesByCategory[category] && sourcesByCategory[category].length > 0) {
      md += `### ${getCategoryDisplayName(category)}\n\n`;
      for (const source of sourcesByCategory[category]) {
        md += `${formatSource(source)}\n`;
      }
      md += '\n';
    }
  }
  
  // Any remaining categories not in the order
  for (const category of Object.keys(sourcesByCategory)) {
    if (!categoryOrder.includes(category) && sourcesByCategory[category].length > 0) {
      md += `### ${getCategoryDisplayName(category)}\n\n`;
      for (const source of sourcesByCategory[category]) {
        md += `${formatSource(source)}\n`;
      }
      md += '\n';
    }
  }

  if (neighborhoodSources.length === 0) {
    md += `*No sources currently listed for this neighborhood.*\n\n`;
  }

  // Statistics summary
  md += `---

## 📊 Source Statistics

| Category | Count |
|----------|-------|
`;

  for (const category of categoryOrder) {
    if (sourcesByCategory[category]) {
      md += `| ${getCategoryDisplayName(category).replace(/^[^ ]+ /, '')} | ${sourcesByCategory[category].length} |\n`;
    }
  }
  
  md += `| **Total** | **${neighborhoodSources.length}** |\n`;

  // Tags
  if (neighborhood.tags && neighborhood.tags.length > 0) {
    md += `
---

## 🏷️ Tags

${neighborhood.tags.map(t => `\`${t}\``).join(' ')}
`;
  }

  // Footer
  md += `
---

*This profile was automatically generated from the Neighborhood Reporter data files.*  
*Last updated: ${generatedDate}*
`;

  return md;
}

/**
 * Main execution
 */
async function main() {
  console.log('📝 Generating Neighborhood Profiles...\n');

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Load all data
  const neighborhoods = await loadNeighborhoods();
  const sources = await loadAllSources();
  const leaders = await loadLeaders();

  console.log(`📂 Loaded data:`);
  console.log(`   ${neighborhoods.length} neighborhoods`);
  console.log(`   ${sources.length} sources`);
  console.log(`   ${leaders.length} leaders\n`);

  // Generate profile for each neighborhood
  for (const neighborhood of neighborhoods) {
    const profile = generateProfile(neighborhood, sources, leaders);
    const outputPath = path.join(OUTPUT_DIR, `${neighborhood.id}-profile.md`);
    
    await fs.writeFile(outputPath, profile, 'utf8');
    console.log(`✓ Generated: ${outputPath}`);
  }

  console.log(`\n✅ Profile generation complete!`);
  console.log(`   Output: ${OUTPUT_DIR}/`);
}

main().catch(err => {
  console.error('❌ Error generating profiles:', err);
  process.exit(1);
});
