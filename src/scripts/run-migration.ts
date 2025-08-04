// src/scripts/run-migration.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MigrationService } from '../migration/migration.service';
import { AppDataSource } from '../../ormconfig';

async function main() {
  try {
    // initialize shared DataSource if you're using it separately
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn', 'debug'], // adjust if desired
    });

    const migrationService = app.get(MigrationService);
    await migrationService.migrateAll();

    console.log('✅ Migration completed successfully.');
    await app.close();
    process.exit(0);
  } catch (err: unknown) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

void main();
