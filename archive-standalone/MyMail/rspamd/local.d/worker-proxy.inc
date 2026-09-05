# Rspamd proxy worker - milter mode for Stalwart integration
bind_socket = "*:11332";
count = 1;
timeout = 120s;
upstream "local" {
    default = yes;
    self_scan = yes;
}
milter = yes;
