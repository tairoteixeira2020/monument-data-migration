import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommandModule } from 'nestjs-command';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Facility } from './entities/facility.entity';
import { Unit } from './entities/unit.entity';
import { Tenant } from './entities/tenant.entity';
import { RentalContract } from './entities/rental-contract.entity';
import { RentalInvoice } from './entities/rental-invoice.entity';
import { MigrationModule } from './migration/migration.module';
import { AppDataSource } from '../ormconfig';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => AppDataSource.options,
    }),
    TypeOrmModule.forFeature([
      Facility,
      Unit,
      Tenant,
      RentalContract,
      RentalInvoice,
    ]),
    CommandModule,
    MigrationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
