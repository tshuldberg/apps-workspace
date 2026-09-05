<?php
/*****************************************************************************
 * MyMail - Roundcube Webmail Configuration
 * Production configuration for Stalwart mail backend
 *****************************************************************************/

// ─── Database ──────────────────────────────────────────────────────────────
$config['db_dsnw'] = 'sqlite:////var/roundcube/db/roundcube.db?mode=0646';

// ─── IMAP Connection ───────────────────────────────────────────────────────
$config['imap_host'] = 'ssl://stalwart:993';
$config['imap_auth_type'] = 'LOGIN';
$config['imap_conn_options'] = array(
    'ssl' => array(
        'verify_peer'       => false,  // internal network, self-signed ok
        'verify_peer_name'  => false,
    ),
);

// ─── SMTP Connection ───────────────────────────────────────────────────────
$config['smtp_host'] = 'tls://stalwart:587';
$config['smtp_auth_type'] = 'LOGIN';
$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['smtp_conn_options'] = array(
    'ssl' => array(
        'verify_peer'       => false,
        'verify_peer_name'  => false,
    ),
);

// ─── System ────────────────────────────────────────────────────────────────
$config['support_url'] = '';
$config['product_name'] = 'MyMail';
$config['des_key'] = 'CHANGE-THIS-24CHAR-KEY!';  // Replaced by setup.sh
$config['skin'] = 'elastic';
$config['language'] = 'en_US';

// ─── Plugins ───────────────────────────────────────────────────────────────
$config['plugins'] = array(
    'archive',
    'zipdownload',
    'managesieve',
);

// ─── ManageSieve ───────────────────────────────────────────────────────────
$config['managesieve_host'] = 'stalwart';
$config['managesieve_port'] = 4190;
$config['managesieve_usetls'] = false;
$config['managesieve_auth_type'] = 'LOGIN';

// ─── User Interface ────────────────────────────────────────────────────────
$config['htmleditor'] = 4;  // always compose in HTML
$config['draft_autosave'] = 60;
$config['mime_param_folding'] = 0;
$config['preview_pane'] = true;
$config['list_cols'] = array('flag', 'status', 'subject', 'fromto', 'date', 'size');
$config['message_show_email'] = true;
$config['prefer_html'] = true;

// ─── Upload / Attachment Limits ────────────────────────────────────────────
$config['upload_max_filesize'] = '25M';

// ─── Security ──────────────────────────────────────────────────────────────
$config['force_https'] = true;
$config['use_https'] = true;
$config['login_autocomplete'] = 0;
$config['ip_check'] = true;
$config['session_lifetime'] = 30;  // minutes
$config['password_charset'] = 'UTF-8';
$config['sendmail_delay'] = 2;

// ─── Logging ───────────────────────────────────────────────────────────────
$config['log_driver'] = 'stdout';
$config['smtp_log'] = true;
$config['imap_debug'] = false;
$config['smtp_debug'] = false;
