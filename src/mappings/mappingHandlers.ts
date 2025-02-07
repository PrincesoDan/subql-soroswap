import { Account, Transfer, Sync } from "../types";
import {
  StellarOperation,
  StellarEffect,
  SorobanEvent,
} from "@subql/types-stellar";
import {
  AccountCredited,
  AccountDebited,
} from "@stellar/stellar-sdk/lib/horizon/types/effects";
import { Horizon, scValToNative } from "@stellar/stellar-sdk";
import { Address, xdr } from "@stellar/stellar-sdk";

// export async function handleOperation(
//   op: StellarOperation<Horizon.HorizonApi.PaymentOperationResponse>
// ): Promise<void> {
//   logger.info(`Indexing operation ${op.id}, type: ${op.type}`);

//   const fromAccount = await checkAndGetAccount(op.from, op.ledger.sequence);
//   const toAccount = await checkAndGetAccount(op.to, op.ledger.sequence);

//   const payment = Payment.create({
//     id: op.id,
//     fromId: fromAccount.id,
//     toId: toAccount.id,
//     txHash: op.transaction_hash,
//     amount: op.amount,
//   });

//   fromAccount.lastSeenLedger = op.ledger.sequence;
//   toAccount.lastSeenLedger = op.ledger.sequence;
//   await Promise.all([fromAccount.save(), toAccount.save(), payment.save()]);
// }

// export async function handleCredit(
//   effect: StellarEffect<AccountCredited>
// ): Promise<void> {
//   logger.info(`Indexing effect ${effect.id}, type: ${effect.type}`);

//   const account = await checkAndGetAccount(
//     effect.account,
//     effect.ledger.sequence
//   );

//   const credit = Credit.create({
//     id: effect.id,
//     accountId: account.id,
//     amount: effect.amount,
//   });

//   account.lastSeenLedger = effect.ledger.sequence;
//   await Promise.all([account.save(), credit.save()]);
// }

// export async function handleDebit(
//   effect: StellarEffect<AccountDebited>
// ): Promise<void> {
//   logger.info(`Indexing effect ${effect.id}, type: ${effect.type}`);

//   const account = await checkAndGetAccount(
//     effect.account,
//     effect.ledger.sequence
//   );

//   const debit = Debit.create({
//     id: effect.id,
//     accountId: account.id,
//     amount: effect.amount,
//   });

//   account.lastSeenLedger = effect.ledger.sequence;
//   await Promise.all([account.save(), debit.save()]);
// }

export async function handleEvent(event: SorobanEvent): Promise<void> {
  logger.info(
    `New transfer event found at block ${event.ledger.sequence.toString()}`
  );

  // Get data from the event
  // The transfer event has the following payload \[env, from, to\]
  logger.info(JSON.stringify(event));
  const {
    topic: [env, from, to],
  } = event;

  try {
    decodeAddress(from);
    decodeAddress(to);
  } catch (e) {
    logger.info(`decode address failed`);
  }

  const fromAccount = await checkAndGetAccount(
    decodeAddress(from),
    event.ledger.sequence
  );
  const toAccount = await checkAndGetAccount(
    decodeAddress(to),
    event.ledger.sequence
  );

  // Create the new transfer entity
  const transfer = Transfer.create({
    id: event.id,
    ledger: event.ledger.sequence,
    date: new Date(event.ledgerClosedAt),
    contract: event.contractId?.contractId().toString()!,
    fromId: fromAccount.id,
    toId: toAccount.id,
    value: BigInt(scValToNative(event.value)),
  });

  fromAccount.lastSeenLedger = event.ledger.sequence;
  toAccount.lastSeenLedger = event.ledger.sequence;
  await Promise.all([fromAccount.save(), toAccount.save(), transfer.save()]);
}

export async function handleEventSync(event: SorobanEvent): Promise<void> {
  logger.info(
    `New sync event found at block ${event.ledger.sequence.toString()}`
  );

  // Registrar el evento completo para debugging
  logger.info("AQUI" + JSON.stringify(event));
  
  // Extraer los topics del evento

  // Extraer los datos del evento
  // El SyncEvent contiene {new_reserve_0: i128, new_reserve_1: i128}
  // const eventData = scValToNative(event.value);
  // logger.info(eventData.toString());
  // Crear la nueva entidad sync
  const sync = Sync.create({
    id: "0238946906331807744-0000000000",                                     // ID único del evento
    ledger: 1000,                    // Número del ledger
    date: new Date(),            // Timestamp del ledger
    contract: "CAM7DY53G63XA4AJRS24Z6VFYAFSSF76C3RZ45BE5YU3FQS5255OOABP", // Dirección del contrato
    newReserve0: BigInt(1000),    // Nuevo reserve0 como BigInt
    newReserve1: BigInt(10001)     // Nuevo reserve1 como BigInt
  });

  // Guardar la entidad en la base de datos
  await sync.save();
}

async function checkAndGetAccount(
  id: string,
  ledgerSequence: number
): Promise<Account> {
  let account = await Account.get(id.toLowerCase());
  if (!account) {
    // We couldn't find the account
    account = Account.create({
      id: id.toLowerCase(),
      firstSeenLedger: ledgerSequence,
    });
  }
  return account;
}

// scValToNative not works, temp solution
function decodeAddress(scVal: xdr.ScVal): string {
  try {
    return Address.account(scVal.address().accountId().ed25519()).toString();
  } catch (e) {
    return Address.contract(scVal.address().contractId()).toString();
  }
}
