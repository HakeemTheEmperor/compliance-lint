@Entity()
export class SafeEntity {
  @Hash()
  password: string;

  @Encrypt()
  bankAccount: string;

  expiresAt: Date;

  @ManyToOne(() => AccountEntity, { onDelete: "CASCADE" })
  account: AccountEntity;
}
