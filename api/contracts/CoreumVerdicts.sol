// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CoreumVerdicts — verdicts of the Coreum AI verification network, on Robinhood Chain.
/// @notice Every verification job (a question answered by independent AI cores with
/// commit-reveal) gets its majority verdict written here once, never changed.
/// Anyone — a person, a dApp, another contract — can read it with verdictOf().
/// The off-chain record (every core's answer, reason and commitment) lives in the
/// public SHA-256 ledger at coreum.xyz; `ledgerHash` is that record's block hash,
/// so the two can always be matched.
contract CoreumVerdicts {
    uint8 public constant YES = 1;
    uint8 public constant NO = 2;
    uint8 public constant UNSURE = 3;

    struct Verdict {
        bytes32 questionHash; // sha256 of the exact question text
        bytes32 ledgerHash;   // hash of the ledger block that sealed the result
        uint32 ledgerBlock;   // position of that block in the ledger
        uint8 verdict;        // 1 YES · 2 NO · 3 UNSURE
        uint8 agreePct;       // share of valid answers that match the verdict, 0-100
        uint8 cores;          // number of valid answers
        uint64 sealedAt;      // block.timestamp when written here
    }

    struct Input {
        uint256 jobId;
        bytes32 questionHash;
        bytes32 ledgerHash;
        uint32 ledgerBlock;
        uint8 verdict;
        uint8 agreePct;
        uint8 cores;
    }

    address public immutable writer;
    mapping(uint256 => Verdict) private _verdicts;
    uint256 public count;
    uint256 public lastJobId;

    event VerdictSealed(
        uint256 indexed jobId,
        uint8 verdict,
        uint8 agreePct,
        uint8 cores,
        bytes32 questionHash,
        bytes32 ledgerHash,
        uint32 ledgerBlock
    );

    error NotWriter();
    error BadVerdict(uint256 jobId);

    constructor() {
        writer = msg.sender;
    }

    /// @notice Write a batch of verdicts. Already-written jobs are skipped, so a
    /// retried batch never overwrites anything.
    function seal(Input[] calldata batch) external {
        if (msg.sender != writer) revert NotWriter();
        for (uint256 i = 0; i < batch.length; i++) {
            Input calldata v = batch[i];
            if (v.verdict < YES || v.verdict > UNSURE || v.agreePct > 100) revert BadVerdict(v.jobId);
            if (_verdicts[v.jobId].sealedAt != 0) continue;
            _verdicts[v.jobId] = Verdict({
                questionHash: v.questionHash,
                ledgerHash: v.ledgerHash,
                ledgerBlock: v.ledgerBlock,
                verdict: v.verdict,
                agreePct: v.agreePct,
                cores: v.cores,
                sealedAt: uint64(block.timestamp)
            });
            unchecked {
                count++;
            }
            if (v.jobId > lastJobId) lastJobId = v.jobId;
            emit VerdictSealed(v.jobId, v.verdict, v.agreePct, v.cores, v.questionHash, v.ledgerHash, v.ledgerBlock);
        }
    }

    /// @notice The verdict for a job; `sealedAt == 0` means not written (yet).
    function verdictOf(uint256 jobId) external view returns (Verdict memory) {
        return _verdicts[jobId];
    }

    /// @notice Convenience for other contracts: true/false/unsure as a single call.
    /// @return verdict 1 YES · 2 NO · 3 UNSURE · 0 unknown job
    function answer(uint256 jobId) external view returns (uint8 verdict, uint8 agreePct) {
        Verdict storage v = _verdicts[jobId];
        return (v.verdict, v.agreePct);
    }
}
