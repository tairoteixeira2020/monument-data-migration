import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('facility')
export class Facility {
  @PrimaryGeneratedColumn()
  facilityId: number;

  @Column({ length: 100, unique: true })
  name: string;
}
