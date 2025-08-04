import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  RelationId,
} from 'typeorm';
import { Unit } from './unit.entity';
import { Tenant } from './tenant.entity';
import { RentalInvoice } from './rental-invoice.entity';
import { isoDateTransformer } from '../transformers/iso-date.transformer';

@Entity('rentalContract')
export class RentalContract {
  @PrimaryGeneratedColumn()
  rentalContractId: number;

  /** Many contracts are linked to one unit */
  @ManyToOne(() => Unit, { nullable: false })
  @JoinColumn({ name: 'unitId' })
  unit: Unit;

  @RelationId((rc: RentalContract) => rc.unit)
  unitId: number;

  /** Many contracts are linked to one tenant */
  @ManyToOne(() => Tenant, (tenant) => tenant.rentalContracts, {
    nullable: false,
  })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @RelationId((rc: RentalContract) => rc.tenant)
  tenantId: number;

  @Column({ type: 'timestamp', transformer: isoDateTransformer })
  startDate: string;

  @Column({
    type: 'timestamp',
    nullable: true,
    transformer: isoDateTransformer,
  })
  endDate?: string;

  /** Sum of rentalInvoice.invoiceBalance */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  currentAmountOwed: number;

  /** A rental contract can have multiple invoices */
  @OneToMany(() => RentalInvoice, (invoice) => invoice.rentalContract)
  invoices: RentalInvoice[];
}
