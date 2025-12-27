#!/usr/bin/env tsx
/**
 * Database Restore Script
 *
 * Restores a database backup file.
 * Run with: tsx scripts/restore-db.ts <backup-file>
 *
 * Example: tsx scripts/restore-db.ts backups/local_2025-01-15T10-30-00.db
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';

const DB_PATH = path.join(process.cwd(), 'local.db');

function calculateChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function decompressFile(inputPath: string, outputPath: string): Promise<void> {
  const { createGunzip } = await import('zlib');
  const { pipeline } = await import('stream/promises');

  const gunzip = createGunzip();
  const source = fs.createReadStream(inputPath);
  const destination = fs.createWriteStream(outputPath);

  await pipeline(source, gunzip, destination);
}

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${question} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function restore(): Promise<void> {
  const backupFile = process.argv[2];

  if (!backupFile) {
    console.error('❌ Usage: tsx scripts/restore-db.ts <backup-file>');
    console.error('   Example: tsx scripts/restore-db.ts backups/local_2025-01-15T10-30-00.db');
    process.exit(1);
  }

  const backupPath = path.resolve(backupFile);

  console.log('📦 Starting database restore...');

  // Check if backup file exists
  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Backup file not found: ${backupPath}`);
    process.exit(1);
  }

  const isCompressed = backupPath.endsWith('.gz');

  // Check metadata file
  const metadataPath = `${backupPath}.meta.json`;
  let metadata: any = null;

  if (fs.existsSync(metadataPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      console.log(`📄 Backup metadata found:`);
      console.log(`   Created: ${metadata.createdAt}`);
      console.log(`   Size: ${(metadata.size / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`   Checksum: ${metadata.checksum?.substring(0, 16)}...`);
    } catch (error) {
      console.warn('⚠️  Could not read metadata file');
    }
  }

  // Warn if current database exists
  if (fs.existsSync(DB_PATH)) {
    console.warn('⚠️  WARNING: This will overwrite the current database!');
    console.warn(`   Current database: ${DB_PATH}`);

    const confirmed = await askConfirmation('Do you want to continue?');
    if (!confirmed) {
      console.log('❌ Restore cancelled');
      process.exit(0);
    }

    // Create backup of current database
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const currentBackup = path.join(
      path.dirname(DB_PATH),
      `local_before_restore_${backupTimestamp}.db`
    );

    console.log(`💾 Creating backup of current database: ${currentBackup}`);
    fs.copyFileSync(DB_PATH, currentBackup);
  }

  try {
    let sourceFile = backupPath;

    // Decompress if needed
    if (isCompressed) {
      console.log('🗜️  Decompressing backup...');
      const tempPath = backupPath.replace('.gz', '');
      await decompressFile(backupPath, tempPath);
      sourceFile = tempPath;
    }

    // Verify checksum if metadata available
    if (metadata?.checksum && !isCompressed) {
      console.log('🔒 Verifying checksum...');
      const actualChecksum = await calculateChecksum(sourceFile);
      if (actualChecksum !== metadata.checksum) {
        console.error('❌ Checksum mismatch! Backup file may be corrupted.');
        console.error(`   Expected: ${metadata.checksum}`);
        console.error(`   Actual:   ${actualChecksum}`);

        if (isCompressed && fs.existsSync(sourceFile)) {
          fs.unlinkSync(sourceFile); // Clean up decompressed file
        }

        process.exit(1);
      }
      console.log('✅ Checksum verified');
    }

    // Restore database
    console.log(`📝 Restoring database to: ${DB_PATH}`);
    fs.copyFileSync(sourceFile, DB_PATH);

    // Clean up decompressed temp file
    if (isCompressed && sourceFile !== backupPath) {
      fs.unlinkSync(sourceFile);
    }

    const restoredStats = fs.statSync(DB_PATH);
    const restoredSizeMB = (restoredStats.size / (1024 * 1024)).toFixed(2);

    console.log('✅ Database restored successfully!');
    console.log(`   Restored size: ${restoredSizeMB} MB`);
    console.log(`   Location: ${DB_PATH}`);
  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

// Run restore
restore().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
