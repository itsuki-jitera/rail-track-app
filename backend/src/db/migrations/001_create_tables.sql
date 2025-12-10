-- Rail Track Database Schema
-- Version: 1.0.0
-- PostgreSQL Migration Script

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'operator', 'viewer', 'user')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    railway_line VARCHAR(100),
    section_start VARCHAR(50),
    section_end VARCHAR(50),
    measurement_date DATE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create measurement_sessions table
CREATE TABLE IF NOT EXISTS measurement_sessions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    session_name VARCHAR(100) NOT NULL,
    measurement_type VARCHAR(50) DEFAULT 'versine',
    file_path TEXT,
    original_filename VARCHAR(255),
    file_size BIGINT,
    data_points INTEGER,
    start_position DECIMAL(10, 3),
    end_position DECIMAL(10, 3),
    measurement_interval DECIMAL(5, 3) DEFAULT 0.25,
    speed DECIMAL(5, 2),
    temperature DECIMAL(5, 2),
    weather_condition VARCHAR(50),
    operator_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Create calculation_results table
CREATE TABLE IF NOT EXISTS calculation_results (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES measurement_sessions(id) ON DELETE CASCADE,
    calculation_type VARCHAR(50) NOT NULL,
    parameters JSONB,
    processing_time_ms INTEGER,
    result_summary JSONB,
    quality_score DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Create versine_data table (for storing processed versine data)
CREATE TABLE IF NOT EXISTS versine_data (
    id SERIAL PRIMARY KEY,
    result_id INTEGER REFERENCES calculation_results(id) ON DELETE CASCADE,
    position DECIMAL(10, 3) NOT NULL,
    versine_10m DECIMAL(8, 3),
    versine_10m_restored DECIMAL(8, 3),
    restoration_amount DECIMAL(8, 3),
    angle DECIMAL(8, 5),
    radius DECIMAL(10, 2),
    quality_flag VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries on versine_data
CREATE INDEX idx_versine_data_result_position ON versine_data(result_id, position);
CREATE INDEX idx_versine_data_position ON versine_data(position);

-- Create filter_configurations table
CREATE TABLE IF NOT EXISTS filter_configurations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    filter_type VARCHAR(50) NOT NULL,
    parameters JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create analysis_presets table
CREATE TABLE IF NOT EXISTS analysis_presets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    preset_type VARCHAR(50),
    configuration JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create export_history table
CREATE TABLE IF NOT EXISTS export_history (
    id SERIAL PRIMARY KEY,
    result_id INTEGER REFERENCES calculation_results(id),
    export_format VARCHAR(20) NOT NULL,
    file_path TEXT,
    file_size BIGINT,
    exported_by INTEGER REFERENCES users(id),
    exported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    download_count INTEGER DEFAULT 0
);

-- Create system_logs table
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    log_level VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    message TEXT NOT NULL,
    details JSONB,
    user_id INTEGER REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_trail table
CREATE TABLE IF NOT EXISTS audit_trail (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create batch_jobs table
CREATE TABLE IF NOT EXISTS batch_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    total_items INTEGER,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    configuration JSONB,
    error_log JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create performance_metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value DECIMAL(15, 3),
    unit VARCHAR(20),
    context JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_filter_configurations_updated_at BEFORE UPDATE ON filter_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_presets_updated_at BEFORE UPDATE ON analysis_presets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW v_recent_calculations AS
SELECT
    cr.id,
    cr.calculation_type,
    cr.parameters,
    cr.processing_time_ms,
    cr.quality_score,
    cr.created_at,
    ms.session_name,
    ms.original_filename,
    p.name as project_name,
    u.username as created_by_username
FROM calculation_results cr
JOIN measurement_sessions ms ON cr.session_id = ms.id
LEFT JOIN projects p ON ms.project_id = p.id
LEFT JOIN users u ON cr.created_by = u.id
ORDER BY cr.created_at DESC
LIMIT 100;

-- Create materialized view for statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_calculation_statistics AS
SELECT
    DATE_TRUNC('day', created_at) as date,
    calculation_type,
    COUNT(*) as count,
    AVG(processing_time_ms) as avg_processing_time,
    AVG(quality_score) as avg_quality_score
FROM calculation_results
GROUP BY DATE_TRUNC('day', created_at), calculation_type;

-- Create index on materialized view
CREATE INDEX idx_mv_calc_stats_date ON mv_calculation_statistics(date);

-- Insert default admin user (password: admin123 - should be changed)
INSERT INTO users (username, email, password_hash, full_name, role)
VALUES (
    'admin',
    'admin@railtrack.local',
    '$2b$10$YourHashedPasswordHere', -- Replace with actual hashed password
    'System Administrator',
    'admin'
) ON CONFLICT (username) DO NOTHING;

-- Insert default filter configurations
INSERT INTO filter_configurations (name, description, filter_type, parameters, is_default) VALUES
('Standard Lowpass', '標準ローパスフィルタ', 'lowpass', '{"cutoff": 0.5, "order": 4}', true),
('Strong Noise Reduction', '強力ノイズ除去', 'lowpass', '{"cutoff": 0.3, "order": 6}', false),
('Bandpass Filter', 'バンドパスフィルタ', 'bandpass', '{"low": 0.1, "high": 0.8}', false);

-- Grant permissions (adjust as needed)
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_user;