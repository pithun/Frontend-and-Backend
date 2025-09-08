--News API Key 11a5a1f11b614295a2c034acd5e2b046
--Gemini Key AIzaSyDLA2gqss5qhdYYsSQ8oyZ12Z1kPiUoinQ
--Airflow email pwd gipvjtvlargkqpvn

Create User Moses identified by 'moses@123';

CREATE DATABASE Security_DB;

CREATE TABLE Security_DB.news_articles (
    id BIGINT AUTO_INCREMENT,
    publish_date DATE NOT NULL,
    news_content TEXT NOT NULL,
    label VARCHAR(100),
    state VARCHAR(100),
    SHARD KEY (publish_date),  -- sharding by state and date
    SORT KEY (state),  -- index for faster date queries
    KEY(id)
);


INSERT INTO Security_DB.news_articles (publish_date, news_content, label, state) VALUES
('2025-07-01', 'Armed robbery reported in Ikorodu area, residents demand more police patrols.', 1, 'Lagos'),
('2025-07-02', 'Peaceful Eid celebration in Abuja with increased security presence.', 0, 'FCT'),
('2025-07-03', 'Bandits attack village in southern Kaduna, several injured.', 1, 'Kaduna'),
('2025-07-04', 'New police units deployed in Rivers state to tackle rising crime rates.', 0, 'Rivers'),
('2025-07-05', 'Suspected kidnappers apprehended by security forces in Oyo.', 1, 'Oyo'),
('2025-07-06', 'Security summit held in Enugu to address youth unemployment and crime prevention.', 0, 'Enugu'),
('2025-07-07', 'Cult-related violence erupts in Warri, leaving two dead.', 1, 'Delta'),
('2025-07-08', 'Nasarawa community launches neighborhood watch to curb petty theft.', 0, 'Nasarawa'),
('2025-07-09', 'Terrorist cell dismantled by military in Zamfara forest.', 1, 'Zamfara'),
('2025-07-10', 'Anambra police report zero criminal activity during last weekend’s festival.', 0, 'Anambra');