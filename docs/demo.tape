Output assets/demo.gif

Set FontSize 15
Set Width 1100
Set Height 560
Set Theme "Dracula"
Set Padding 20
Set CursorBlink true

# 1. version check
Type "nbridge --version"
Sleep 1
Enter
Sleep 1

# 2. list mounted accounts (refresh tokens live in the OS keychain, not on disk)
Type "nbridge list"
Sleep 1
Enter
Sleep 2

# 3. narrate the one-time add flow (browser-gated; runs once per account)
Type "# nbridge add  ->  browser OAuth, refresh token saved to OS keychain"
Sleep 1
Enter
Sleep 1
Type "#   account added: founder@workmail.com   (id: acct-1)"
Sleep 1
Enter
Sleep 1
Type "#   account added: ops@sidehive.io        (id: acct-2)"
Sleep 1
Enter
Sleep 2

# 4. boot the bridge + MCP server from one command (no client -> exits cleanly)
Type "nbridge up < /dev/null"
Sleep 1
Enter
Sleep 3

# 5. the value moment: one tool call fans out across both inboxes
Type "# agent -> gmail.list  (one tool call, both inboxes, merged + account-tagged)"
Sleep 1
Enter
Sleep 2
Type "# -> founder@workmail.com: 3 unread   |   ops@sidehive.io: 5 unread"
Sleep 1
Enter
Sleep 3
