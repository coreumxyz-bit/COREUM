// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CoreumTokenRegistry — the Coreum network's latest grade for each token on Robinhood Chain.
/// @notice A safety oracle any contract can read by token address: the grade (A to F), the
/// verdict of the AI cores, how many agreed, and when the check was made. Every entry points
/// at the job whose full record (facts, every core's answer, commit-reveal) is public at
/// coreum.xyz/v/<jobId> and sealed in CoreumVerdicts.
/// A risk screen from public on-chain facts, not an audit and not financial advice.
contract CoreumTokenRegistry {
    // grade letters
    uint8 public constant A = 1;
    uint8 public constant B = 2;
    uint8 public constant C = 3;
    uint8 public constant D = 4;
    uint8 public constant F = 5;
    // verdicts, as in CoreumVerdicts
    uint8 public constant NO_RED_FLAGS = 1;
    uint8 public constant RED_FLAGS = 2;
    uint8 public constant MIXED = 3;

    struct Grade {
        uint8 letter;     // 1 A · 2 B · 3 C · 4 D · 5 F · 0 never checked
        uint8 score;      // 0-100
        uint8 verdict;    // 1 no red flags · 2 red flags · 3 mixed
        uint8 agreePct;   // share of cores that agree with the verdict, 0-100
        uint32 jobId;     // the check: coreum.xyz/v/<jobId>
        uint64 checkedAt; // when the cores sealed that check (unix seconds)
        uint64 updatedAt; // when it was written here
    }

    struct Input {
        address token;
        uint8 letter;
        uint8 score;
        uint8 verdict;
        uint8 agreePct;
        uint32 jobId;
        uint64 checkedAt;
    }

    address public owner;  // can change the writer; holds no funds
    address public writer; // the network's hourly writer
    mapping(address => Grade) private _grades;
    uint256 public tokens; // distinct tokens ever graded

    event GradeUpdated(address indexed token, uint8 letter, uint8 score, uint8 verdict, uint8 agreePct, uint32 jobId, uint64 checkedAt);
    event WriterChanged(address writer);
    event OwnerChanged(address owner);

    error NotWriter();
    error NotOwner();
    error BadGrade(address token);

    constructor(address writer_) {
        owner = msg.sender;
        writer = writer_;
        emit OwnerChanged(msg.sender);
        emit WriterChanged(writer_);
    }

    /// @notice Write the latest grades. An entry older than (or as old as) the one stored is
    /// skipped, so a retried or out-of-order batch never rolls a grade back.
    function update(Input[] calldata batch) external {
        if (msg.sender != writer) revert NotWriter();
        for (uint256 i = 0; i < batch.length; i++) {
            Input calldata g = batch[i];
            if (g.letter < A || g.letter > F || g.score > 100 || g.verdict < NO_RED_FLAGS || g.verdict > MIXED || g.agreePct > 100)
                revert BadGrade(g.token);
            Grade storage cur = _grades[g.token];
            if (cur.checkedAt >= g.checkedAt) continue;
            if (cur.letter == 0) {
                unchecked {
                    tokens++;
                }
            }
            _grades[g.token] = Grade(g.letter, g.score, g.verdict, g.agreePct, g.jobId, g.checkedAt, uint64(block.timestamp));
            emit GradeUpdated(g.token, g.letter, g.score, g.verdict, g.agreePct, g.jobId, g.checkedAt);
        }
    }

    /// @notice The latest grade for a token; letter 0 means the network never checked it.
    function gradeOf(address token) external view returns (Grade memory) {
        return _grades[token];
    }

    /// @notice One call for a swap or a launchpad: is there a recent check that came out clean?
    /// @param maxAge how old the check may be, in seconds (e.g. 86400 for a day)
    /// @return ok true when the token was graded A or B within maxAge
    /// @return letter the grade letter (0 if never checked)
    function isClean(address token, uint256 maxAge) external view returns (bool ok, uint8 letter) {
        Grade storage g = _grades[token];
        letter = g.letter;
        ok = letter != 0 && letter <= B && block.timestamp - g.checkedAt <= maxAge;
    }

    function setWriter(address writer_) external {
        if (msg.sender != owner) revert NotOwner();
        writer = writer_;
        emit WriterChanged(writer_);
    }

    function setOwner(address owner_) external {
        if (msg.sender != owner) revert NotOwner();
        owner = owner_;
        emit OwnerChanged(owner_);
    }
}
