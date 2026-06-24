CREATE DATABASE IF NOT EXISTS goodser
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE goodser;

-- 库存目录
CREATE TABLE IF NOT EXISTS inventories (
    id          VARCHAR(36) PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    owner_openid VARCHAR(255) NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_owner (owner_openid)
) ENGINE=InnoDB;

-- 商品
CREATE TABLE IF NOT EXISTS products (
    id                VARCHAR(36) PRIMARY KEY,
    inventory_id      VARCHAR(36) NOT NULL,
    code              VARCHAR(50) NOT NULL,
    main_zone         CHAR(1) NOT NULL,
    sub_zone          CHAR(1) NOT NULL,
    seq_number        INT NOT NULL,
    quantity          INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    status_code       CHAR(1) NOT NULL DEFAULT 'A',
    name              VARCHAR(500) NOT NULL,
    original_price    DECIMAL(12,2) NOT NULL DEFAULT 0,
    market_price      DECIMAL(12,2) NOT NULL DEFAULT 0,
    expected_price    DECIMAL(12,2) NOT NULL DEFAULT 0,
    remark            TEXT,
    storage_location  VARCHAR(255) DEFAULT '',
    image_url         VARCHAR(1024) DEFAULT '',
    image_list        JSON,
    tags              JSON,
    owner_openid      VARCHAR(255) NOT NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_inventory (inventory_id),
    INDEX idx_zone (inventory_id, main_zone, sub_zone),
    INDEX idx_seq (inventory_id, seq_number),
    INDEX idx_status (status_code),
    FULLTEXT INDEX ft_name (name)
) ENGINE=InnoDB;

-- 序号回收池
CREATE TABLE IF NOT EXISTS recycled_seq_numbers (
    id            VARCHAR(36) PRIMARY KEY,
    inventory_id  VARCHAR(36) NOT NULL,
    main_zone     CHAR(1) NOT NULL,
    sub_zone      CHAR(1) NOT NULL,
    seq_number    INT NOT NULL,
    recycled_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_zone_seq (inventory_id, main_zone, sub_zone, seq_number)
) ENGINE=InnoDB;

-- 序号计数器
CREATE TABLE IF NOT EXISTS seq_counters (
    id            VARCHAR(36) PRIMARY KEY,
    inventory_id  VARCHAR(36) NOT NULL,
    main_zone     CHAR(1) NOT NULL,
    sub_zone      CHAR(1) NOT NULL,
    current_max   INT NOT NULL DEFAULT 0,
    UNIQUE INDEX idx_unique_zone (inventory_id, main_zone, sub_zone)
) ENGINE=InnoDB;

-- 出库单/预留单
CREATE TABLE IF NOT EXISTS outbound_orders (
    id                VARCHAR(36) PRIMARY KEY,
    inventory_id      VARCHAR(36) NOT NULL,
    order_no          VARCHAR(50) NOT NULL,
    type              ENUM('outbound','reserve') NOT NULL DEFAULT 'outbound',
    status            ENUM('pending','reserved','confirmed','cancelled') NOT NULL DEFAULT 'pending',
    order_info        TEXT,
    remark            TEXT,
    items             JSON NOT NULL,
    source_reserve_id VARCHAR(36) DEFAULT NULL,
    owner_openid      VARCHAR(255) NOT NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    confirmed_at      DATETIME DEFAULT NULL,
    cancelled_at      DATETIME DEFAULT NULL,
    INDEX idx_inventory (inventory_id),
    INDEX idx_type (inventory_id, type),
    INDEX idx_status (inventory_id, status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- 入库日志
CREATE TABLE IF NOT EXISTS inbound_logs (
    id            VARCHAR(36) PRIMARY KEY,
    inventory_id  VARCHAR(36) NOT NULL,
    order_no      VARCHAR(50) DEFAULT '',
    type          ENUM('single','batch','search') NOT NULL DEFAULT 'single',
    remark        TEXT,
    items         JSON NOT NULL,
    owner_openid  VARCHAR(255) NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_inventory (inventory_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- 白名单
CREATE TABLE IF NOT EXISTS whitelist (
    id          VARCHAR(36) PRIMARY KEY,
    openid      VARCHAR(255) NOT NULL,
    nickname    VARCHAR(255) DEFAULT '',
    avatar_url  VARCHAR(1024) DEFAULT '',
    role        ENUM('admin','member') NOT NULL DEFAULT 'member',
    added_by    VARCHAR(255) DEFAULT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_openid (openid)
) ENGINE=InnoDB;

-- 状态编码
CREATE TABLE IF NOT EXISTS status_codes (
    id            VARCHAR(36) PRIMARY KEY,
    code          CHAR(1) NOT NULL,
    label         VARCHAR(100) NOT NULL,
    is_system     BOOLEAN NOT NULL DEFAULT FALSE,
    owner_openid  VARCHAR(255) NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_code (code)
) ENGINE=InnoDB;

-- 标签
CREATE TABLE IF NOT EXISTS tags (
    id            VARCHAR(36) PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    color         VARCHAR(7) NOT NULL DEFAULT '#1890ff',
    owner_openid  VARCHAR(255) NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_name (name)
) ENGINE=InnoDB;

-- 预设数据
INSERT IGNORE INTO status_codes (id, code, label, is_system, owner_openid) VALUES
    ('sc_a', 'A', '正常', TRUE, 'system'),
    ('sc_b', 'B', '预留', TRUE, 'system'),
    ('sc_c', 'C', '已拆', TRUE, 'system'),
    ('sc_d', 'D', '损坏', TRUE, 'system'),
    ('sc_e', 'E', '过期', TRUE, 'system'),
    ('sc_f', 'F', '停用', TRUE, 'system'),
    ('sc_n', 'N', '全新', TRUE, 'system');

INSERT IGNORE INTO tags (id, name, color, owner_openid) VALUES
    ('tag_hot',     '热销', '#ff4d4f', 'system'),
    ('tag_new',     '新品', '#1890ff', 'system'),
    ('tag_clear',   '清仓', '#faad14', 'system'),
    ('tag_pre',     '预售', '#722ed1', 'system'),
    ('tag_digi',    '电子数码', '#13c2c2', 'system'),
    ('tag_access',  '配件', '#52c41a', 'system');
