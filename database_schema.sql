-- Schema para Banco de Dados de Urgência Pediátrica
-- Hospital Pediátrico do Lubango "Pioneiro Zeca"

CREATE DATABASE IF NOT EXISTS hospital_zeca_urgencia;
USE hospital_zeca_urgencia;

-- Tabela de Médicos e Operadores
CREATE TABLE users (
    id VARCHAR(128) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role ENUM('admin', 'medic') DEFAULT 'medic',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Pacientes (Recolha de Dados)
CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_unico VARCHAR(50) UNIQUE DEFAULT (CONCAT('PZ-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(id, 4, '0'))),
    nome VARCHAR(255) NOT NULL,
    genero ENUM('Masculino', 'Feminino', 'Outro') NOT NULL,
    data_nascimento DATE NOT NULL,
    idade INT NOT NULL,
    faixa_etaria VARCHAR(50),
    data_ocorrencia DATE,
    hora_entrada TIME,
    hora_saida TIME,
    tempo_atendimento_min INT,
    status ENUM('Atendido', 'Em Espera') DEFAULT 'Em Espera',
    peso DECIMAL(5,2),
    temperatura DECIMAL(4,1),
    pressao_arterial VARCHAR(20),
    provincia VARCHAR(100),
    cidade VARCHAR(100),
    bairro VARCHAR(100),
    ocorrencia_tipo TEXT,
    sinais_sintomas TEXT,
    diagnosticos TEXT,
    prioridade ENUM('Emergência', 'Muito Urgente', 'Urgente', 'Pouco Urgente', 'Não Urgente'),
    estado_final ENUM('Internado', 'Atendido', 'Transferido', 'Alta', 'Óbito'),
    id_medico VARCHAR(128),
    assinatura_medico VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_medico) REFERENCES users(id)
);

-- Tabela de Auditoria de Alertas
CREATE TABLE system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    email_alerts_enabled BOOLEAN DEFAULT FALSE,
    target_alert_email VARCHAR(255),
    last_sync_timestamp TIMESTAMP
);
