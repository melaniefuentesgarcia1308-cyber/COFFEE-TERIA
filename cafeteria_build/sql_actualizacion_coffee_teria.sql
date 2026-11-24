CREATE DATABASE IF NOT EXISTS `cefeteriap`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `cefeteriap`;

-- Estructuras compatibles con COFFEE-TERIA-cefeteriap.sql.
-- No elimina ni reemplaza tablas o registros existentes.
SET @coffee_teria_add_paypal_reference = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `TblPago` ADD COLUMN `Referencia` VARCHAR(100) NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'TblPago'
    AND COLUMN_NAME = 'Referencia'
);
PREPARE coffee_teria_paypal_reference_stmt FROM @coffee_teria_add_paypal_reference;
EXECUTE coffee_teria_paypal_reference_stmt;
DEALLOCATE PREPARE coffee_teria_paypal_reference_stmt;

CREATE TABLE IF NOT EXISTS `TblUsuario` (
  `IdUsuario` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdEmpleado` INT UNSIGNED NOT NULL,
  `Usuario` VARCHAR(60) NOT NULL,
  `PasswordHash` VARCHAR(255) NOT NULL,
  `Rol` ENUM('Administrador','Cajero','Barista') NOT NULL,
  `Activo` TINYINT(1) NOT NULL DEFAULT 1,
  `UltimoAcceso` DATETIME NULL,
  `FechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdUsuario`),
  UNIQUE KEY `uq_usuario_nombre` (`Usuario`),
  UNIQUE KEY `uq_usuario_empleado` (`IdEmpleado`),
  CONSTRAINT `fk_usuario_empleado`
    FOREIGN KEY (`IdEmpleado`) REFERENCES `TblEmpleado` (`IdEmpleado`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `TblNomina` (
  `IdNomina` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdEmpleado` INT UNSIGNED NOT NULL,
  `PeriodoInicio` DATE NOT NULL,
  `PeriodoFin` DATE NOT NULL,
  `SueldoBase` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `Bonificaciones` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `Deducciones` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `TotalPagado` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `FechaPago` DATETIME NULL,
  `Estado` VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
  `Observaciones` VARCHAR(500) NULL,
  PRIMARY KEY (`IdNomina`),
  KEY `idx_nomina_empleado_periodo` (`IdEmpleado`,`PeriodoInicio`,`PeriodoFin`),
  CONSTRAINT `fk_nomina_empleado`
    FOREIGN KEY (`IdEmpleado`) REFERENCES `TblEmpleado` (`IdEmpleado`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `chk_nomina_importes` CHECK (
    `SueldoBase` >= 0 AND `Bonificaciones` >= 0 AND
    `Deducciones` >= 0 AND `TotalPagado` >= 0
  ),
  CONSTRAINT `chk_nomina_periodo` CHECK (`PeriodoFin` >= `PeriodoInicio`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `TblSesion` (
  `IdSesion` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdUsuario` INT UNSIGNED NOT NULL,
  `TokenHash` CHAR(64) NOT NULL,
  `ExpiraEn` DATETIME NOT NULL,
  `Activa` TINYINT(1) NOT NULL DEFAULT 1,
  `FechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdSesion`),
  UNIQUE KEY `uq_sesion_token` (`TokenHash`),
  KEY `idx_sesion_usuario` (`IdUsuario`,`Activa`,`ExpiraEn`),
  CONSTRAINT `fk_sesion_usuario`
    FOREIGN KEY (`IdUsuario`) REFERENCES `TblUsuario` (`IdUsuario`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

SELECT 'Actualización de acceso, nómina y sesiones verificada en cefeteriap' AS Resultado;
