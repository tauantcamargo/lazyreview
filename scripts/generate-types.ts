#!/usr/bin/env tsx
/**
 * OpenAPI Type Generation Script
 *
 * Generates TypeScript types from provider OpenAPI specifications.
 * Run with: pnpm generate:types
 */

import fs from 'node:fs';
import path from 'node:path';

const PROVIDERS_DIR = path.join(__dirname, '..', 'packages', 'core', 'src', 'providers');

// OpenAPI spec URLs for each provider
const OPENAPI_SPECS = {
  github:
    'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.yaml',
  // GitLab doesn't have a single OpenAPI spec, types are maintained manually
  // gitlab: 'manual',
  // Bitbucket and Azure DevOps specs are not publicly available in a single file
  // bitbucket: 'manual',
  // azuredevops: 'manual',
};

async function generateTypes() {
  console.log('🔄 Generating TypeScript types from OpenAPI specs...\n');

  // Dynamic import for openapi-typescript
  const openapiTS = await import('openapi-typescript');

  for (const [provider, specUrl] of Object.entries(OPENAPI_SPECS)) {
    if (specUrl === 'manual') {
      console.log(`⏭️  Skipping ${provider} (manually maintained types)`);
      continue;
    }

    const outputPath = path.join(PROVIDERS_DIR, provider, 'types.generated.ts');
    const outputDir = path.dirname(outputPath);

    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`📥 Fetching ${provider} OpenAPI spec...`);
    console.log(`   URL: ${specUrl}`);

    try {
      const output = await openapiTS.default(specUrl, {
        exportType: true,
        pathParamsAsTypes: true,
      });

      fs.writeFileSync(outputPath, output);
      console.log(`✅ Generated ${provider} types: ${outputPath}\n`);
    } catch (error) {
      console.error(`❌ Failed to generate ${provider} types:`, error);
      console.log(`   You may need to maintain types manually for ${provider}\n`);
    }
  }

  console.log('✨ Type generation complete!');
  console.log('\nNote: Some providers may require manually maintained types due to');
  console.log('limited OpenAPI spec availability. Check each provider directory.');
}

// Run if called directly
generateTypes().catch(console.error);
