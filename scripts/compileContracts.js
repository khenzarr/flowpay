// Compiles minimal ERC-20 and ERC-721 contracts using solc
// Writes bytecodes + ABIs to lib/bytecodes.json
// Run: node scripts/compileContracts.js

const solc = require("solc");
const fs = require("fs");
const path = require("path");

// ── ERC-20 source ─────────────────────────────────────────────────────────────
const ERC20_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) public {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
`;

// ── ERC-721 source ────────────────────────────────────────────────────────────
const ERC721_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockERC721 {
    string public name;
    string public symbol;
    uint256 public totalSupply;
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getApproved;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to) public returns (uint256) {
        totalSupply += 1;
        uint256 tokenId = totalSupply;
        ownerOf[tokenId] = to;
        balanceOf[to] += 1;
        emit Transfer(address(0), to, tokenId);
        return tokenId;
    }

    function approve(address to, uint256 tokenId) public {
        require(ownerOf[tokenId] == msg.sender, "Not owner");
        getApproved[tokenId] = to;
        emit Approval(msg.sender, to, tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(ownerOf[tokenId] == from, "Not owner");
        require(msg.sender == from || msg.sender == getApproved[tokenId], "Not authorized");
        ownerOf[tokenId] = to;
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        delete getApproved[tokenId];
        emit Transfer(from, to, tokenId);
    }
}
`;

function compile(contractName, source) {
  const input = {
    language: "Solidity",
    sources: { [`${contractName}.sol`]: { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter((e) => e.severity === "error");
    if (errors.length > 0) {
      console.error("Compilation errors:", errors);
      process.exit(1);
    }
  }

  const contract = output.contracts[`${contractName}.sol`][contractName];
  return {
    abi: contract.abi,
    bytecode: "0x" + contract.evm.bytecode.object,
  };
}

console.log("Compiling ERC-20...");
const erc20 = compile("MockERC20", ERC20_SOURCE);
console.log(`ERC-20 bytecode: ${erc20.bytecode.length} chars, ${(erc20.bytecode.length - 2) / 2} bytes`);

console.log("Compiling ERC-721...");
const erc721 = compile("MockERC721", ERC721_SOURCE);
console.log(`ERC-721 bytecode: ${erc721.bytecode.length} chars, ${(erc721.bytecode.length - 2) / 2} bytes`);

const out = {
  erc20: { abi: erc20.abi, bytecode: erc20.bytecode },
  erc721: { abi: erc721.abi, bytecode: erc721.bytecode },
};

const outPath = path.join(__dirname, "..", "lib", "bytecodes.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log("Written to lib/bytecodes.json");

// Validate
console.log("ERC-20 valid hex:", /^0x[0-9a-fA-F]+$/.test(erc20.bytecode));
console.log("ERC-721 valid hex:", /^0x[0-9a-fA-F]+$/.test(erc721.bytecode));
console.log("ERC-20 even bytes:", (erc20.bytecode.length - 2) % 2 === 0);
console.log("ERC-721 even bytes:", (erc721.bytecode.length - 2) % 2 === 0);
