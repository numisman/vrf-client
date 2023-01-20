import * as anchor from "@project-serum/anchor";
import * as sbv2 from "@switchboard-xyz/solana.js";
import { assert } from "chai";
import { VrfClient } from "../target/types/vrf_client";

describe("vrf-client", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.VrfClient as Program<VrfClient>;
  const provider = program.provider as anchor.AnchorProvider;
  const payer = (provider.wallet as sbv2.AnchorWallet).payer;

  let switchboard: sbv2.SwitchboardTestContext;
  let payerTokenAddress: anchor.web3.PublicKey;

  const vrfKeypair = anchor.web3.Keypair.generate();

  let vrfClientKey: anchor.web3.PublicKey;
  let vrfClientBump: number;
  [vrfClientKey, vrfClientBump] = anchor.utils.publicKey.findProgramAddressSync(
    [Buffer.from("CLIENTSEED"), vrfKeypair.publicKey.toBytes()],
    program.programId
  );

  before(async () => {
    switchboard = await sbv2.SwitchboardTestContext.loadFromEnv(
      program.provider as anchor.AnchorProvider
    );
    const queueData = await switchboard.queue.loadData();
    const queueOracles = await switchboard.queue.loadOracles();
    [payerTokenAddress] = await switchboard.program.mint.getOrCreateWrappedUser(
      switchboard.program.walletPubkey,
      { fundUpTo: 0.75 }
    );
    assert(queueOracles.length > 0, `No oracles actively heartbeating`);
    console.log(`oracleQueue: ${switchboard.queue.publicKey}`);
    console.log(
      `unpermissionedVrfEnabled: ${queueData.unpermissionedVrfEnabled}`
    );
    console.log(`# of oracles heartbeating: ${queueOracles.length}`);
    logSuccess("Switchboard localnet environment loaded successfully");
  });

  it("init_client", async () => {
    const [vrfAccount] = await switchboard.queue.createVrf({
      vrfKeypair,
      authority: vrfClientKey,
      callback: {
        programId: program.programId,
        accounts: [],
        ixData: Buffer.from(""),
      },
      enable: true,
    });
    const vrf = await vrfAccount.loadData();
    logSuccess(`Created VRF Account: ${vrfAccount.publicKey.toBase58()}`);
    console.log(
      "callback",
      JSON.stringify(
        {
          programId: vrf.callback.programId.toBase58(),
          accounts: vrf.callback.accounts.slice(0, vrf.callback.accountsLen),
          ixData: vrf.callback.ixData.slice(0, vrf.callback.ixDataLen),
        },
        undefined,
        2
      )
    );

    const tx = await program.methods
      .initClient({
        maxResult: new anchor.BN(1337),
      })
      .accounts({
        state: vrfClientKey,
        vrf: vrfAccount.publicKey,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("init_client transaction signature", tx);
  });
});