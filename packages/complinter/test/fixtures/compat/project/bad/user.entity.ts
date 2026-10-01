@Entity()
export class UserEntity {
  password: string;

  ssn: string;

  bankAccount: string;

  @ManyToOne(() => AccountEntity)
  account: AccountEntity;

  @OneToOne(() => ProfileEntity, { onDelete: "RESTRICT" })
  profile: ProfileEntity;
}
