/**
 * Validate Data Script
 * 
 * Validates all YAML data files against their JSON schemas.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Initialize AJV with formats
const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

/**
 * Load a JSON schema
 */
async function loadSchema(schemaPath) {
  const content = await fs.readFile(schemaPath, 'utf8');
  return JSON.parse(content);
}

/**
 * Load a YAML file
 */
async function loadYaml(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return yaml.load(content);
}

/**
 * Format validation errors for display
 */
function formatErrors(errors, filePath) {
  return errors.map(err => {
    const location = err.instancePath || 'root';
    return `  - ${location}: ${err.message}`;
  }).join('\n');
}

/**
 * Validate neighborhoods
 */
async function validateNeighborhoods() {
  console.log('📍 Validating neighborhoods...');
  const dir = path.join(DATA_DIR, 'neighborhoods');
  const schemaPath = path.join(dir, '_schema.json');
  
  const schema = await loadSchema(schemaPath);
  const validate = ajv.compile(schema);
  
  const files = await fs.readdir(dir);
  const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  
  let valid = 0;
  let invalid = 0;
  
  for (const file of yamlFiles) {
    const filePath = path.join(dir, file);
    const data = await loadYaml(filePath);
    
    if (validate(data)) {
      console.log(`   ✓ ${file}`);
      valid++;
    } else {
      console.log(`   ✗ ${file}`);
      console.log(formatErrors(validate.errors, filePath));
      invalid++;
    }
  }
  
  return { valid, invalid };
}

/**
 * Validate sources
 */
async function validateSources() {
  console.log('\n📰 Validating sources...');
  const dir = path.join(DATA_DIR, 'sources');
  const schemaPath = path.join(dir, '_schema.json');
  
  const schema = await loadSchema(schemaPath);
  const validate = ajv.compile(schema);
  
  const files = await fs.readdir(dir);
  const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  
  let valid = 0;
  let invalid = 0;
  
  for (const file of yamlFiles) {
    const filePath = path.join(dir, file);
    const data = await loadYaml(filePath);
    
    if (validate(data)) {
      const count = data.sources ? data.sources.length : 0;
      console.log(`   ✓ ${file} (${count} sources)`);
      valid++;
    } else {
      console.log(`   ✗ ${file}`);
      console.log(formatErrors(validate.errors, filePath));
      invalid++;
    }
  }
  
  return { valid, invalid };
}

/**
 * Validate leaders
 */
async function validateLeaders() {
  console.log('\n👤 Validating leaders...');
  const dir = path.join(DATA_DIR, 'leaders');
  const schemaPath = path.join(dir, '_schema.json');
  
  const schema = await loadSchema(schemaPath);
  const validate = ajv.compile(schema);
  
  const files = await fs.readdir(dir);
  const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  
  let valid = 0;
  let invalid = 0;
  
  for (const file of yamlFiles) {
    const filePath = path.join(dir, file);
    const data = await loadYaml(filePath);
    
    if (validate(data)) {
      const count = data.leaders ? data.leaders.length : 0;
      console.log(`   ✓ ${file} (${count} leaders)`);
      valid++;
    } else {
      console.log(`   ✗ ${file}`);
      console.log(formatErrors(validate.errors, filePath));
      invalid++;
    }
  }
  
  return { valid, invalid };
}

/**
 * Check for duplicate IDs
 */
async function checkDuplicateIds() {
  console.log('\n🔍 Checking for duplicate IDs...');
  
  const ids = {
    neighborhoods: new Set(),
    sources: new Set(),
    leaders: new Set()
  };
  
  const duplicates = {
    neighborhoods: [],
    sources: [],
    leaders: []
  };
  
  // Check neighborhoods
  const neighborhoodDir = path.join(DATA_DIR, 'neighborhoods');
  const neighborhoodFiles = (await fs.readdir(neighborhoodDir))
    .filter(f => f.endsWith('.yaml'));
  
  for (const file of neighborhoodFiles) {
    const data = await loadYaml(path.join(neighborhoodDir, file));
    if (data && data.id) {
      if (ids.neighborhoods.has(data.id)) {
        duplicates.neighborhoods.push(data.id);
      }
      ids.neighborhoods.add(data.id);
    }
  }
  
  // Check sources
  const sourcesDir = path.join(DATA_DIR, 'sources');
  const sourceFiles = (await fs.readdir(sourcesDir))
    .filter(f => f.endsWith('.yaml'));
  
  for (const file of sourceFiles) {
    const data = await loadYaml(path.join(sourcesDir, file));
    if (data && data.sources) {
      for (const source of data.sources) {
        if (ids.sources.has(source.id)) {
          duplicates.sources.push(source.id);
        }
        ids.sources.add(source.id);
      }
    }
  }
  
  // Check leaders
  const leadersDir = path.join(DATA_DIR, 'leaders');
  const leaderFiles = (await fs.readdir(leadersDir))
    .filter(f => f.endsWith('.yaml'));
  
  for (const file of leaderFiles) {
    const data = await loadYaml(path.join(leadersDir, file));
    if (data && data.leaders) {
      for (const leader of data.leaders) {
        if (ids.leaders.has(leader.id)) {
          duplicates.leaders.push(leader.id);
        }
        ids.leaders.add(leader.id);
      }
    }
  }
  
  // Report duplicates
  let hasDuplicates = false;
  
  if (duplicates.neighborhoods.length > 0) {
    console.log(`   ✗ Duplicate neighborhood IDs: ${duplicates.neighborhoods.join(', ')}`);
    hasDuplicates = true;
  }
  
  if (duplicates.sources.length > 0) {
    console.log(`   ✗ Duplicate source IDs: ${duplicates.sources.join(', ')}`);
    hasDuplicates = true;
  }
  
  if (duplicates.leaders.length > 0) {
    console.log(`   ✗ Duplicate leader IDs: ${duplicates.leaders.join(', ')}`);
    hasDuplicates = true;
  }
  
  if (!hasDuplicates) {
    console.log('   ✓ No duplicate IDs found');
  }
  
  return {
    valid: hasDuplicates ? 0 : 1,
    invalid: hasDuplicates ? 1 : 0,
    duplicates
  };
}

/**
 * Main validation function
 */
async function validate() {
  console.log('🔍 Validating Neighborhood Reporter Data...\n');
  
  const results = {
    neighborhoods: await validateNeighborhoods(),
    sources: await validateSources(),
    leaders: await validateLeaders(),
    duplicates: await checkDuplicateIds()
  };
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Validation Summary');
  console.log('='.repeat(50));
  
  const totalValid = results.neighborhoods.valid + results.sources.valid + 
                     results.leaders.valid + results.duplicates.valid;
  const totalInvalid = results.neighborhoods.invalid + results.sources.invalid + 
                       results.leaders.invalid + results.duplicates.invalid;
  
  console.log(`   Neighborhoods: ${results.neighborhoods.valid} valid, ${results.neighborhoods.invalid} invalid`);
  console.log(`   Sources:       ${results.sources.valid} valid, ${results.sources.invalid} invalid`);
  console.log(`   Leaders:       ${results.leaders.valid} valid, ${results.leaders.invalid} invalid`);
  console.log(`   ID Uniqueness: ${results.duplicates.valid ? 'Pass' : 'Fail'}`);
  console.log('='.repeat(50));
  
  if (totalInvalid > 0) {
    console.log('\n❌ Validation failed with errors');
    process.exit(1);
  } else {
    console.log('\n✅ All validations passed!');
  }
}

// Run validation
validate().catch(err => {
  console.error('❌ Validation failed:', err);
  process.exit(1);
});
