import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  RelationId,
  Index,
} from 'typeorm';
import { RentalContract } from './rental-contract.entity';
import { isoDateTransformer } from '../transformers/iso-date.transformer';

@Entity('rentalInvoice')
@Index(['rentalContract', 'invoiceDueDate'], { unique: true }) // prevent duplicate invoice for same due date
export class RentalInvoice {
  @PrimaryGeneratedColumn()
  rentalInvoiceId: number;

  @ManyToOne(() => RentalContract, (contract) => contract.invoices, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rentalContractId' })
  rentalContract: RentalContract;

  @RelationId((invoice: RentalInvoice) => invoice.rentalContract)
  rentalContractId: number;

  @Column({ type: 'timestamp', transformer: isoDateTransformer })
  invoiceDueDate: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  invoiceAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  invoiceBalance: number;
}
