<img width="1092" alt="Screenshot 2021-09-22 at 4 28 48 pm" src="https://user-images.githubusercontent.com/727262/134373822-0d1c2ab2-4461-46a5-bdec-47c70d1392ba.png">

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
- Provides quick actions for excluding specific signatures
- Respects the `exclude-signatures`, `exclude-path-patterns` and `exclude-entropy-patterns` options from your `tartufo.toml`
