import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Facility } from './src/entities/facility.entity';
import { Unit } from './src/entities/unit.entity';
import { Tenant } from './src/entities/tenant.entity';
import { RentalContract } from './src/entities/rental-contract.entity';
import { RentalInvoice } from './src/entities/rental-invoice.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5437,
  username: process.env.DB_USER || 'monument',
  password: process.env.DB_PASS || 'monument123',
  database: process.env.DB_NAME || 'monument',
  entities: [Facility, Unit, Tenant, RentalContract, RentalInvoice],
  synchronize: true, // For technical testing, we can leave it true
  logging: false,
});

export default AppDataSource;
