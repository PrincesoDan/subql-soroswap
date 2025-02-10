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
   // Log para debug
   logger.info("EVENT" + JSON.stringify(event));
   logger.info("VALUE" + JSON.stringify(event.value));

  // Option 1
  function extractReserves(scvMap: any): { reserve0: bigint, reserve1: bigint } {
    // Asumimos que el mapa tiene la estructura correcta
    const entries = scvMap._value;
    
    let reserve0 = BigInt(0);
    let reserve1 = BigInt(0);
    
    entries.forEach((entry: any) => {
      // Convertir el Buffer a string para identificar qué reserva es
      const keyBuffer = entry._attributes.key._value.data;
      const keyString = Buffer.from(keyBuffer).toString();
      
      // Obtener el valor de lo
      const value = BigInt(entry._attributes.val._value._attributes.lo._value);
      
      if (keyString === 'new_reserve_0') {
        reserve0 = value;
      } else if (keyString === 'new_reserve_1') {
        reserve1 = value;
      }
    });
    
    return { reserve0, reserve1 };
  }
  
  // Uso:
  const reserves = extractReserves(event.value);
  console.log(`Reserve0: ${reserves.reserve0}`);
  console.log(`Reserve1: ${reserves.reserve1}`);


//   // Option 2
//    const scValMap = event.value as any;
//    let newReserve0 = BigInt(0);
//    let newReserve1 = BigInt(0);

//   try {
//     // Convertir el ScVal map a un objeto JavaScript
//     const nativeValue = scValToNative(event.value);
//     logger.info("Converted value: " + nativeValue);

//     // Extraer los valores del mapa convertido
//     const newReserve0 = BigInt(nativeValue.new_reserve_0 ?? 0);
//     const newReserve1 = BigInt(nativeValue.new_reserve_1 ?? 0);

//     logger.info(`Final values - Reserve0: ${newReserve0}, Reserve1: ${newReserve1}`);

//     // Crear la nueva entidad sync
//     const sync = Sync.create({
//       id: `${event.id}-${event.ledger.sequence}`,
//       ledger: event.ledger.sequence,
//       date: new Date(event.ledgerClosedAt),
//       contract: event.contractId?.contractId().toString()!,
//       newReserve0: newReserve0,
//       newReserve1: newReserve1
//     });

//     await sync.save();
//     logger.info(`Saved sync entity with id: ${sync.id}`);
    
//   } catch (error) {
//     logger.error("Error processing sync event: " + error);
//     logger.error("Event value: " + JSON.stringify(event.value));
//     throw error;
//   }

} // cierre de función

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
