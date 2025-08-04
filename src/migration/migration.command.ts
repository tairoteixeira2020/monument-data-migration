import { Command } from 'nestjs-command';
import { Injectable } from '@nestjs/common';
import { MigrationService } from './migration.service';

@Injectable()
export class MigrationCommand {
  constructor(private readonly migrationService: MigrationService) {}

  @Command({
    command: 'migrate:all',
    describe: 'Run full migration (units + rentRoll)',
  })
  async migrateAll() {
    await this.migrationService.migrateAll();
  }
}
