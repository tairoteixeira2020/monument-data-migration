import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { RentalContract } from './rental-contract.entity';

@Entity('tenant')
export class Tenant {
  @PrimaryGeneratedColumn()
  tenantId: number;

  @Column({ length: 50 })
  firstName: string;

  @Column({ length: 50 })
  lastName: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  /** One tenant can have multiple rental contracts */
  @OneToMany(() => RentalContract, (contract) => contract.tenant)
  rentalContracts: RentalContract[];
}
