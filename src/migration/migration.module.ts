import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MigrationService } from './migration.service';
import { MigrationCommand } from './migration.command';
import { CommandModule } from 'nestjs-command';
import { Facility } from '../entities/facility.entity';
import { Unit } from '../entities/unit.entity';
import { Tenant } from '../entities/tenant.entity';
import { RentalContract } from '../entities/rental-contract.entity';
import { RentalInvoice } from '../entities/rental-invoice.entity';

@Module({
  imports: [
    CommandModule,
    TypeOrmModule.forFeature([
      Facility,
      Unit,
      Tenant,
      RentalContract,
      RentalInvoice,
    ]),
  ],
  providers: [MigrationService, MigrationCommand],
  exports: [MigrationService],
})
export class MigrationModule {}
