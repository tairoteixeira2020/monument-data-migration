// src/migration/migration.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as csv from 'fast-csv';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Facility } from '../entities/facility.entity';
import { Unit } from '../entities/unit.entity';
import { Tenant } from '../entities/tenant.entity';
import { RentalContract } from '../entities/rental-contract.entity';
import { RentalInvoice } from '../entities/rental-invoice.entity';
import type { DeepPartial } from 'typeorm';
import path from 'path';

interface UnitCsvRow {
  facilityName: string;
  unitNumber: string;
  unitSize: string; // format like "10x12x12"
  unitType: string;
}

interface RentRollRow {
  facilityName: string;
  unitNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  rentStartDate: string;
  rentEndDate: string;
  monthlyRent: string;
  currentRentOwed: string;
  currentRentOwedDueDate: string;
}

let insertedUnits = 0;
let insertedFacily = 0;
let processed = 0;
let createdTenants = 0;
let createdContracts = 0;
let createdInvoices = 0;

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @InjectRepository(Facility) private facilityRepo: Repository<Facility>,
    @InjectRepository(Unit) private unitRepo: Repository<Unit>,
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    @InjectRepository(RentalContract)
    private contractRepo: Repository<RentalContract>,
    @InjectRepository(RentalInvoice)
    private invoiceRepo: Repository<RentalInvoice>,
    private dataSource: DataSource,
  ) {}

  /**
   * Safely turn an unknown value into a number. Falls back to 0 if unparseable.
   */
  private safeParseNumber(v: unknown): number {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = parseFloat(v);
      return Number.isNaN(n) ? 0 : n;
    }
    return 0;
  }

  /** Entry point: run full pipeline */
  async migrateAll(): Promise<void> {
    await this.migrateUnits();
    await this.migrateRentRoll();
  }

  /** Migrate units CSV into facility + unit tables */
  async migrateUnits(): Promise<void> {
    const folderName = process.env.DATA_FOLDER_NAME || 'client1_health';
    const filePath = path.resolve(`./data/${folderName}/unit.csv`);
    if (!fs.existsSync(filePath)) {
      this.logger.error(`Units CSV not found at path: ${filePath}`);
      throw new Error(`Missing file: ${filePath}`);
    }

    const rows: UnitCsvRow[] = await this.parseCsv<UnitCsvRow>(filePath);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const facilityCache = new Map<string, Facility>();

      for (const row of rows) {
        if (!row.facilityName || !row.unitNumber || !row.unitSize) {
          this.logger.warn(
            `Skipping malformed unit row: ${JSON.stringify(row)}`,
          );
          fs.appendFileSync(
            'logs/migration-errors.log',
            `[${new Date().toISOString()}] unit.csv skipped (missing required field): ${JSON.stringify(row)}\n`,
          );
          continue;
        }

        const sizeTuple = parseUnitSize(row.unitSize);
        if (!sizeTuple) {
          this.logger.warn(`Skipping unit with invalid size: ${row.unitSize}`);
          fs.appendFileSync(
            'logs/migration-errors.log',
            `[${new Date().toISOString()}] unit.csv skipped (invalid size format): ${JSON.stringify(row)}\n`,
          );
          continue;
        }

        const [unitWidth, unitLength, unitHeight] = sizeTuple;
        const facilityName = row.facilityName.trim();

        // Upsert facility using DB-level unique constraint on name
        let facility = facilityCache.get(facilityName);
        if (!facility) {
          const existingFacility = await queryRunner.manager.findOne(Facility, {
            where: { name: facilityName },
          });
          if (existingFacility) {
            facility = existingFacility;
          } else {
            const newFacility = queryRunner.manager.create(Facility, {
              name: facilityName,
            });
            facility = await queryRunner.manager.save(newFacility);
            insertedFacily += 1;
            this.logger.log(
              `Created facility: "${facilityName}" (ID: ${facility.facilityId})`,
            );
          }
          facilityCache.set(facilityName, facility);
        }

        // Idempotent unit: check existing by number + facility
        const existingUnit = await queryRunner.manager.findOne(Unit, {
          where: {
            number: row.unitNumber,
            facility: facility,
          },
          relations: ['facility'],
        });

        if (existingUnit) {
          // Optionally update dimensions or type if changed
          let updated = false;
          if (existingUnit.unitWidth !== unitWidth) {
            existingUnit.unitWidth = unitWidth;
            updated = true;
          }
          if (existingUnit.unitLength !== unitLength) {
            existingUnit.unitLength = unitLength;
            updated = true;
          }
          if (existingUnit.unitHeight !== unitHeight) {
            existingUnit.unitHeight = unitHeight;
            updated = true;
          }
          if (existingUnit.unitType !== row.unitType) {
            existingUnit.unitType = row.unitType;
            updated = true;
          }
          if (updated) {
            await queryRunner.manager.save(Unit, existingUnit);
          }
        } else {
          const newUnit = queryRunner.manager.create(Unit, {
            number: row.unitNumber,
            unitWidth,
            unitLength,
            unitHeight,
            unitType: row.unitType,
            facility: facility,
          });
          await queryRunner.manager.save(Unit, newUnit);
          insertedUnits += 1;
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Units migration finished. New facilities inserted: ${insertedFacily}, new units inserted: ${insertedUnits}.`,
      );
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : JSON.stringify(err);
      this.logger.error('Units migration failed; rolled back.', message);
      fs.appendFileSync(
        'logs/migration-errors.log',
        `[${new Date().toISOString()}] unit.csv migration error: ${message}\n`,
      );
      if (err instanceof Error) throw err;
      else throw new Error(message);
    } finally {
      await queryRunner.release();
    }
  }

  /** Migrate rentRoll.csv into tenant / contract / invoice tables */
  async migrateRentRoll(): Promise<void> {
    const folderName = process.env.DATA_FOLDER_NAME || 'client1_health';
    const filePath = path.resolve(`./data/${folderName}/rentRoll.csv`);
    if (!fs.existsSync(filePath)) {
      this.logger.error(`rentRoll CSV not found at path: ${filePath}`);
      throw new Error(`Missing file: ${filePath}`);
    }

    const rows: RentRollRow[] = await this.parseCsv<RentRollRow>(filePath);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    /**
     * Parses a CSV date/text and returns an ISO‐8601 string,
     * or null if invalid/empty.
     */
    const parseDateSafe = (s?: string | null): string | null => {
      if (!s?.trim()) return null;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d.toISOString();
    };

    try {
      for (const row of rows) {
        processed += 1;

        if (!row.unitNumber || !row.firstName || !row.lastName) {
          this.logger.warn(
            `Skipping malformed rentRoll row: ${JSON.stringify(row)}`,
          );
          fs.appendFileSync(
            'logs/migration-errors.log',
            `[${new Date().toISOString()}] rentRoll.csv skipped (missing required): ${JSON.stringify(row)}\n`,
          );
          continue;
        }

        const normalizedUnitNumber = normalizeUnitNumber(row.unitNumber);
        const normalizedFacilityName = normalizeString(row.facilityName);

        // Lookup unit with facility disambiguation (case-insensitive)
        const unit = await queryRunner.manager
          .createQueryBuilder(Unit, 'unit')
          .leftJoinAndSelect('unit.facility', 'facility')
          .where('unit.number = :number', { number: normalizedUnitNumber })
          .andWhere('LOWER(facility.name) = :facilityName', {
            facilityName: normalizedFacilityName,
          })
          .getOne();

        if (!unit) {
          this.logger.warn(
            `Orphaned rentRoll row: unit not found ${row.unitNumber}`,
          );
          fs.appendFileSync(
            'logs/migration-errors.log',
            `[${new Date().toISOString()}] rentRoll.csv orphaned unit: ${JSON.stringify(row)}\n`,
          );
          continue;
        }

        // OPTIONAL: verify facilityName if rentRoll row has it (to catch mismatches)
        if (row.facilityName) {
          const incomingFacility = String(row.facilityName)
            .trim()
            .toLowerCase();
          const existingFacility = String(unit.facility?.name || '')
            .trim()
            .toLowerCase();
          if (
            incomingFacility &&
            existingFacility &&
            incomingFacility !== existingFacility
          ) {
            this.logger.warn(
              `Facility name mismatch for unit ${row.unitNumber}: rentRoll has "${row.facilityName}", unit record has "${unit.facility?.name}"`,
            );
          }
        }

        // Update unit.monthlyRent if rentRoll has a positive override and it's different
        const rentRollMonthly = this.safeParseNumber(row.monthlyRent) ?? 0;
        if (
          rentRollMonthly > 0 &&
          Number(unit.monthlyRent) !== rentRollMonthly
        ) {
          this.logger.log(
            `Updating unit ${unit.number} base monthlyRent from ${unit.monthlyRent} to ${rentRollMonthly}`,
          );
          unit.monthlyRent = rentRollMonthly;
          // Persist the change (idempotent inside the transaction)
          await queryRunner.manager.save(Unit, unit);
        }

        // Upsert tenant: by email preferred, fallback to name+phone
        let tenant: Tenant | null = null;
        if (row.email) {
          tenant = await queryRunner.manager.findOne(Tenant, {
            where: { email: row.email },
          });
        }

        if (!tenant) {
          const namePhoneWhere: Partial<Omit<Tenant, 'rentalContracts'>> = {
            firstName: row.firstName,
            lastName: row.lastName,
          };
          if (row.phone) {
            namePhoneWhere.phone = row.phone;
          }
          tenant = await queryRunner.manager.findOne(Tenant, {
            where: namePhoneWhere,
          });
        }

        if (tenant) {
          // 3) Update any changed fields
          let changed = false;
          if (tenant.firstName !== row.firstName) {
            tenant.firstName = row.firstName;
            changed = true;
          }
          if (tenant.lastName !== row.lastName) {
            tenant.lastName = row.lastName;
            changed = true;
          }
          if (row.email && tenant.email !== row.email) {
            tenant.email = row.email;
            changed = true;
          }
          if (row.phone && tenant.phone !== row.phone) {
            tenant.phone = row.phone;
            changed = true;
          }

          if (changed) {
            await queryRunner.manager.save(tenant);
          }
        } else {
          // 4) Create new if still not found
          const newTenantData: DeepPartial<Tenant> = {
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone,
          };
          const newTenant = queryRunner.manager.create(Tenant, newTenantData);
          tenant = await queryRunner.manager.save(newTenant);
          createdTenants += 1;
        }

        // Parse values
        const startDateIso = parseDateSafe(row.rentStartDate);
        if (!startDateIso) {
          this.logger.warn(
            `Invalid rentStartDate, skipping row: ${JSON.stringify(row)}`,
          );
          continue;
        }
        const endDateIso = parseDateSafe(row.rentEndDate) ?? undefined;
        const monthlyRent = this.safeParseNumber(row.monthlyRent) || 0;
        const currentRentOwed = this.safeParseNumber(row.currentRentOwed) || 0;
        const invoiceDueDateIso = parseDateSafe(row.currentRentOwedDueDate);

        let contract = await queryRunner.manager.findOne(RentalContract, {
          relations: ['invoices'],
          where: {
            unit: { unitId: unit.unitId },
            tenant: { tenantId: tenant.tenantId },
            startDate: startDateIso, // ISO string → transformer will TO() it back to Date
          },
        });

        if (!contract) {
          const newContractData: DeepPartial<RentalContract> = {
            unit,
            tenant,
            startDate: startDateIso,
            endDate: endDateIso ?? undefined,
            currentAmountOwed: currentRentOwed,
          };
          const newContract = queryRunner.manager.create(
            RentalContract,
            newContractData,
          );
          contract = await queryRunner.manager.save(newContract);
          createdContracts += 1;
        } else {
          let changed = false;

          // 1) startDate
          if (contract.startDate !== startDateIso) {
            contract.startDate = startDateIso;
            changed = true;
          }

          // 2) endDate
          if (
            endDateIso &&
            (!contract.endDate || contract.endDate !== endDateIso)
          ) {
            contract.endDate = endDateIso;
            changed = true;
          }

          // 3) currentAmountOwed
          if (Number(contract.currentAmountOwed) !== currentRentOwed) {
            contract.currentAmountOwed = currentRentOwed;
            changed = true;
          }

          if (changed) {
            await queryRunner.manager.save(RentalContract, contract);
          }
        }

        // Only create/update invoice if there's an owed amount > 0 AND a valid due date
        if (currentRentOwed > 0 && invoiceDueDateIso) {
          // Dedup by ISO string
          let invoice = contract.invoices?.find(
            (inv) =>
              inv.invoiceDueDate && inv.invoiceDueDate === invoiceDueDateIso,
          );

          if (!invoice) {
            invoice = queryRunner.manager.create(RentalInvoice, {
              rentalContract: contract,
              invoiceDueDate: invoiceDueDateIso,
              invoiceAmount: monthlyRent,
              invoiceBalance: currentRentOwed,
            });
            await queryRunner.manager.save(RentalInvoice, invoice);
            createdInvoices += 1;
          } else {
            let updated = false;
            if (invoice.invoiceAmount !== monthlyRent) {
              invoice.invoiceAmount = monthlyRent;
              updated = true;
            }
            if (invoice.invoiceBalance !== currentRentOwed) {
              invoice.invoiceBalance = currentRentOwed;
              updated = true;
            }
            if (updated) {
              await queryRunner.manager.save(RentalInvoice, invoice);
            }
          }
        }

        // Recalculate currentAmountOwed as sum of invoice balances
        const allInvoices = await queryRunner.manager.find(RentalInvoice, {
          where: {
            rentalContract: {
              rentalContractId: contract.rentalContractId,
            },
          },
          relations: ['rentalContract'],
        });
        contract.currentAmountOwed = allInvoices.reduce(
          (sum, inv) => sum + this.safeParseNumber(inv.invoiceBalance as any),
          0,
        );
        await queryRunner.manager.save(RentalContract, contract);
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `rentRoll migration finished. Rows processed: ${processed}, tenants created: ${createdTenants}, contracts created: ${createdContracts}, invoices created: ${createdInvoices}.`,
      );
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : JSON.stringify(err);
      this.logger.error('rentRoll migration failed; rolled back.', message);
      fs.appendFileSync(
        'logs/migration-errors.log',
        `[${new Date().toISOString()}] rentRoll.csv migration error: ${message}\n`,
      );
      if (err instanceof Error) throw err;
      else throw new Error(message);
    } finally {
      await queryRunner.release();
    }
  }

  /** Generic CSV parser returning typed rows */
  private parseCsv<T>(filePath: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const results: T[] = [];
      fs.createReadStream(filePath)
        .pipe(csv.parse({ headers: true, trim: true }))
        .on('error', (error) => reject(error))
        .on('data', (row: unknown) => {
          results.push(row as T);
        })
        .on('end', () => resolve(results));
    });
  }
}

/**
 * Parses a unit size like "10x12x12" (case-insensitive, tolerates spaces)
 * Returns a tuple [width, length, height] if valid, otherwise null.
 */
function parseUnitSize(raw: unknown): [number, number, number] | null {
  if (typeof raw !== 'string') return null;

  // Normalize: remove whitespace, lowercase, split by 'x'
  const cleaned = raw.toLowerCase().replace(/\s/g, '');
  const parts = cleaned.split('x');

  if (parts.length !== 3) {
    return null;
  }

  const nums = parts.map((p) => Number.parseFloat(p));

  if (nums.some((n) => Number.isNaN(n))) {
    return null;
  }

  return [nums[0], nums[1], nums[2]];
}
// Normalize helpers
const normalizeUnitNumber = (raw: unknown): string =>
  String(raw).trim().replace(/\.0+$/, ''); // strip trailing .0 like "1000.0" -> "1000"

const normalizeString = (s?: string): string => (s || '').trim().toLowerCase();
