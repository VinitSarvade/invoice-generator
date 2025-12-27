#!/usr/bin/env tsx
/**
 * Database Backup Script
 *
 * Creates a backup of the SQLite database file with timestamp.
 * Run with: tsx scripts/backup-db.ts
 *
 * Options:
 *   --output <path>   Specify output directory (default: ./backups)
 *   --compress        Compress backup with gzip
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const DB_PATH = path.join(process.cwd(), 'local.db');
const DEFAULT_BACKUP_DIR = path.join(process.cwd(), 'backups');

interface BackupOptions {
  outputDir: string;
  compress: boolean;
}

function parseArgs(): BackupOptions {
  const args = process.argv.slice(2);
  const options: BackupOptions = {
    outputDir: DEFAULT_BACKUP_DIR,
    compress: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      options.outputDir = args[i + 1];
      i++;
    } else if (args[i] === '--compress') {
      options.compress = true;
    }
  }

  return options;
}

function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // YYYY-MM-DDTHH-MM-SS
}

function calculateChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function compressFile(inputPath: string, outputPath: string): Promise<void> {
  const { createGzip } = await import('zlib');
  const { pipeline } = await import('stream/promises');

  const gzip = createGzip({ level: 9 }); // Maximum compression
  const source = fs.createReadStream(inputPath);
  const destination = fs.createWriteStream(outputPath);

  await pipeline(source, gzip, destination);
}

async function backup(): Promise<void> {
  const options = parseArgs();

  console.log('📦 Starting database backup...');

  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Database file not found: ${DB_PATH}`);
    process.exit(1);
  }

  // Create backup directory if it doesn't exist
  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
    console.log(`📁 Created backup directory: ${options.outputDir}`);
  }

  // Generate backup filename with timestamp
  const timestamp = getTimestamp();
  const backupFilename = `local_${timestamp}.db`;
  const backupPath = path.join(options.outputDir, backupFilename);

  try {
    // Copy database file
    console.log(`📝 Copying database to: ${backupPath}`);
    fs.copyFileSync(DB_PATH, backupPath);

    // Calculate checksum
    console.log('🔒 Calculating checksum...');
    const checksum = await calculateChecksum(backupPath);

    // Get file size
    const stats = fs.statSync(backupPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    // Optionally compress
    let finalPath = backupPath;
    let finalSize = fileSizeMB;

    if (options.compress) {
      const gzPath = `${backupPath}.gz`;
      console.log(`🗜️  Compressing backup...`);
      await compressFile(backupPath, gzPath);

      // Remove uncompressed backup
      fs.unlinkSync(backupPath);

      const gzStats = fs.statSync(gzPath);
      finalSize = (gzStats.size / (1024 * 1024)).toFixed(2);
      finalPath = gzPath;

      const compressionRatio = ((1 - gzStats.size / stats.size) * 100).toFixed(1);
      console.log(`📉 Compressed: ${fileSizeMB}MB → ${finalSize}MB (${compressionRatio}% reduction)`);
    }

    // Write metadata file
    const metadataPath = `${finalPath}.meta.json`;
    const metadata = {
      timestamp,
      originalPath: DB_PATH,
      backupPath: finalPath,
      size: stats.size,
      checksum,
      compressed: options.compress,
      createdAt: new Date().toISOString()
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log('✅ Backup completed successfully!');
    console.log(`   File: ${path.basename(finalPath)}`);
    console.log(`   Size: ${finalSize} MB`);
    console.log(`   Checksum: ${checksum.substring(0, 16)}...`);
    console.log(`   Location: ${finalPath}`);

    // Cleanup old backups (keep last 30 days by default)
    cleanupOldBackups(options.outputDir, 30);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

function cleanupOldBackups(backupDir: string, daysToKeep: number): void {
  const now = Date.now();
  const maxAge = daysToKeep * 24 * 60 * 60 * 1000; // Convert days to milliseconds

  const files = fs.readdirSync(backupDir);
  let deletedCount = 0;

  for (const file of files) {
    if (!file.startsWith('local_') || (!file.endsWith('.db') && !file.endsWith('.db.gz'))) {
      continue;
    }

    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    const age = now - stats.mtimeMs;

    if (age > maxAge) {
      console.log(`🗑️  Removing old backup: ${file}`);
      fs.unlinkSync(filePath);

      // Also remove metadata file if exists
      const metaPath = `${filePath}.meta.json`;
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }

      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    console.log(`🧹 Cleaned up ${deletedCount} old backup(s)`);
  }
}

// Run backup
backup().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
