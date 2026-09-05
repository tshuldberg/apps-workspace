# Rspamd general options
# DNS resolver settings
dns {
    nameserver = ["8.8.8.8:53", "1.1.1.1:53"];
    timeout = 5s;
    retransmits = 2;
}

# Disable certain checks for authenticated / local users
local_addrs = [
    "172.28.0.0/16",
    "127.0.0.0/8",
    "::1"
];

# Tempdir for message processing
tempdir = "/tmp";

# History
history_rows = 2000;
