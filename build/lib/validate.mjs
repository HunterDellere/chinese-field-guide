import Ajv from 'ajv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '../../content/_schema/entry.schema.json');
const tagsPath   = join(__dirname, '../../content/_schema/tags.json');

const schema   = JSON.parse(readFileSync(schemaPath, 'utf8'));
const tagSlugs = JSON.parse(readFileSync(tagsPath, 'utf8')).map(t => t.slug);

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

export function validateEntry(frontmatter, filePath) {
  const valid = validate(frontmatter);
  const errors = [];

  if (!valid) {
    for (const err of validate.errors) {
      errors.push(`  ${err.instancePath || '(root)'} ${err.message}`);
    }
  }

  if (frontmatter.tags) {
    for (const tag of frontmatter.tags) {
      if (!tagSlugs.includes(tag)) {
        errors.push(`  tags: unknown tag "${tag}" — add it to content/_schema/tags.json or use an existing slug`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Schema validation failed for ${filePath}:\n${errors.join('\n')}`);
  }
}
