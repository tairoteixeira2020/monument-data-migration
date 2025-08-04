import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  RelationId,
  Unique,
} from 'typeorm';
import { Facility } from './facility.entity';

@Entity('unit')
@Unique(['number', 'facility']) // optional: enforce unit number is unique per facility
export class Unit {
  @PrimaryGeneratedColumn()
  unitId: number;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facilityId' })
  facility: Facility;

  @RelationId((unit: Unit) => unit.facility)
  facilityId: number;

  @Column({ length: 10 })
  number: string;

  @Column('float')
  unitWidth: number;

  @Column('float')
  unitLength: number;

  @Column('float')
  unitHeight: number;

  @Column({ length: 20 })
  unitType: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  monthlyRent: number;
}
