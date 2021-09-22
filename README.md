<img width="1435" alt="Screenshot 2021-09-18 at 9 26 12 am" src="https://user-images.githubusercontent.com/727262/133882237-ba2feec1-99d0-4ce6-bfc2-a27fdbc35779.png">

---

<center>
<h3>Entropy Scanner</h3>
</center>

[![Current Version](https://vsmarketplacebadge.apphb.com/version-short/wayneashleyberry.entropy-scanner.svg)](https://marketplace.visualstudio.com/items?itemName=wayneashleyberry.entropy-scanner)
[![Install Count](https://vsmarketplacebadge.apphb.com/installs-short/wayneashleyberry.entropy-scanner.svg)](https://marketplace.visualstudio.com/items?itemName=wayneashleyberry.entropy-scanner)
[![Rating](https://vsmarketplacebadge.apphb.com/rating-short/wayneashleyberry.entropy-scanner.svg)](https://marketplace.visualstudio.com/items?itemName=wayneashleyberry.entropy-scanner)
[![npm](https://github.com/wayneashleyberry/vscode-entropy-scanner/actions/workflows/npm.yml/badge.svg)](https://github.com/wayneashleyberry/vscode-entropy-scanner/actions/workflows/npm.yml)

> Entropy Scanner detects high entropy strings in your code. This extension is implemented as a language server and client for Visual Studio Code.

High entropy strings may contain passwords, authentication tokens or private keys and should not be committed into version control. This extension provides real time insight into high entropy strings. You should still run pre-commit checks and scan code during continuous integration using another tool like [tartufo](https://github.com/godaddy/tartufo).

_Features_

- Highlight high entropy strings using Visual Studio Code diagnostics
- Considers the `exclude-signatures` and `exclude-path-patterns` options from your `tartufo.toml`
- Provices quick actions for excluding specific signatures
