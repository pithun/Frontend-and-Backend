import pandas as pd
import requests
import pathlib
import re
from bs4 import BeautifulSoup
import logging

logging.basicConfig(level=logging.INFO)

from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.search import SearchParameters, web_source, news_source, x_source, rss_source

import os
import json
from datetime import datetime, timedelta, timezone
from dateutil.relativedelta import relativedelta
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Define your schema
REQUIRED_FIELDS = ["title", "description", "state", "lga", "status"]
OPTIONAL_FIELDS_i = ["incidentDate", "incidentTime"]
OPTIONAL_FIELDS_ii = ["lat", "lng"]
ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS_i + OPTIONAL_FIELDS_ii + ["description_with_more_context", "is_duplicate"]


def normalize_news(news_data):
    """
    Normalize list of dicts into a DataFrame with consistent schema.
    Missing fields are filled with None.
    Validates that all required fields are present (not None) in every row.
    """
    df = pd.DataFrame(news_data)
    for col in ALL_FIELDS:
        if col not in df.columns:
            df[col] = None  # fill missing columns
    # Ensure correct column order
    df = df[ALL_FIELDS]
    
    # Validate required fields: Check for None/NaN in REQUIRED_FIELDS
    missing_mask = df[REQUIRED_FIELDS].isnull().any(axis=1)
    if missing_mask.any():
        missing_rows = df[missing_mask]
        missing_details = missing_rows[REQUIRED_FIELDS].to_dict(orient="records")
        raise ValueError(
            f"Validation failed: {len(missing_rows)} news items are missing required fields. "
            f"Details: {missing_details}"
        )
    
    return df


def save_news_to_csv(news_data, folder="news_data"):
    """Save current run news into a timestamped CSV"""
    os.makedirs(folder, exist_ok=True)
    curr_dt = datetime.now()
    timestamp = curr_dt.strftime("%Y%m%d_%H")
    exec_month = curr_dt.strftime("%Y-%m")
    filepath = os.path.join(folder, exec_month, f"{timestamp}.csv")
    df = normalize_news(news_data)
    df.to_csv(filepath, index=False)
    logging.info(f"✅ Saved {len(df)} news to {filepath}")
    return filepath


def load_recent_news(folder="news_data", days=7):
    """Load news from the last N days of CSVs, handling monthly folder rollover."""
    curr_dt = datetime.now()
    cutoff = curr_dt - timedelta(days=days)
    
    dfs = []
    
    # Determine the range of months to check: from cutoff month to current month
    current_month = curr_dt.replace(day=1)  # Start of current month
    cutoff_month = cutoff.replace(day=1)    # Start of cutoff month
    month = cutoff_month
    while month <= current_month:
        exec_month = month.strftime("%Y-%m")
        news_path = os.path.join(folder, exec_month)
        if os.path.exists(news_path):
            for fname in os.listdir(news_path):
                if fname.endswith(".csv"):
                    try:
                        file_date_str = fname.split(".")[0]
                        file_date = datetime.strptime(file_date_str, "%Y%m%d_%H")
                        if file_date >= cutoff:
                            dfs.append(pd.read_csv(os.path.join(news_path, fname)))
                    except Exception:
                        pass
        # Move to next month
        month += relativedelta(months=1)
    
    return pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()


def deduplicate_news(current_news, past_news, threshold=0.35):
    """Remove duplicates by cosine similarity"""
    if past_news.empty:
        current_news["is_duplicate"] = False
        return current_news

    combined_past = (
            past_news["title"].fillna("") + " " + 
            past_news["description_with_more_context"].fillna("") + " " + 
            past_news["state"].fillna("") + " " + 
            past_news["lga"].fillna("") + " " + 
            past_news["incidentDate"].fillna("")
        ).tolist()
    combined_current = (
            current_news["title"].fillna("") + " " + 
            current_news["description_with_more_context"].fillna("") + " " + 
            current_news["state"].fillna("") + " " + 
            current_news["lga"].fillna("") + " " + 
            current_news["incidentDate"].fillna("")
        ).tolist()

    vectorizer = TfidfVectorizer().fit(combined_past + combined_current)
    past_vecs = vectorizer.transform(combined_past)
    curr_vecs = vectorizer.transform(combined_current)

    duplicates = []
    for i, vec in enumerate(curr_vecs):
        sim = cosine_similarity(vec, past_vecs).max()
        logging.info(sim)
        duplicates.append(sim >= threshold)

    current_news["is_duplicate"] = duplicates
    return current_news

def publish_news(api_key: str, news_items: list):
    """
    Publishes news items to the Convex threats API.

    Args:
        api_key (str): Your Convex API key (string starting with stmp_...).
        news_items (list): A list of dicts containing threat data. 
                           Must include required fields:
                           title, description, state, lga, status
                           Optional fields: incidentDate, incidentTime, lat, lng
    """
    url = f"https://fantastic-mammoth-699.convex.site/api/threats?api_key={api_key}"
    headers = {"Content-Type": "application/json"}

    try:
        responses = []
        for news_item in news_items:
            response = requests.post(url, headers=headers, json=news_item)
            response.raise_for_status()
            logging.info("✅ Successfully published news!")
            responses.append(response.json())
        return responses
    except requests.exceptions.HTTPError as http_err:
        logging.error(f"❌ HTTP error occurred: {http_err} - {response.text}")
        raise
    except Exception as err:
        logging.error(f"❌ Other error occurred: {err}")
        raise

def fetch_security_news(api_key: str):
    """
    Fetch security-related news in Nigeria from the last 8 hours.
    
    Args:
        api_key (str): Your XAI API key.

    Returns:
        list | dict: Parsed JSON object with news items if successful, 
                     or None if parsing fails.
    """
    client = Client(api_key=api_key)

    # Dynamic dates for last 8 hours
    from_date = datetime.now(tz=timezone.utc) - timedelta(hours=8)
    to_date = datetime.now(tz=timezone.utc)

    rss_links=[
                'https://news.google.com/rss/search?q=nigeria+security&hl=en-NG&gl=NG&ceid=NG:en',
                'https://dailytrust.com/feed/',  # Daily Trust
                'https://www.channelstv.com/feed/',  # Channels TV
                'https://www.premiumtimesng.com/feed/'  # Premium Times
            ]

    PROMPT_STRING="""
    Please retrieve news articles from the past 8 hours related to security issues in Nigeria, including incidents such as banditry, gunmen attacks, kidnapping, herdsmen clashes, insurgency, armed robbery, communal violence, police shootings, and other violent or criminal activities.  

    The response must be returned as a valid JSON array. Each news item must follow this schema exactly:

    {
    "title": "<headline of the news>",
    "description": "<concise summary>",
    "description_with_more_context": <a more robust description of the news about 300 words is enough>
    "state": "<state of occurrence>",
    "lga": "<local government area, compulsory — infer if not explicitly stated>",
    "incidentDate": "<publish date in YYYY-MM-DD; required, infer from article if possible>",
    "incidentTime": "<time in HH:MM 24-hour format; if unavailable, use '00:00'>",
    "status": "<one of: 'High', 'Medium', or 'Low'>"
    }

    Rules:
    - - 'lga' must always be inferred (e.g., from state capital if unclear), never Null."
    - All fields are required. If a value cannot be found, infer it from the news content.
    - Ensure the output is strictly valid JSON and can be parsed without errors.
    - Do not include extra text, explanations, or formatting outside of the JSON.
    - If there are multiple states, please create separate entries for each state and fill in an approximate local government but lga must be filled.
    - The "status" field should reflect the severity of the incident based on the description (e.g., "High" for fatalities, "Medium" for injuries, "Low" for property damage only).
    - Aim for diversity: Include reports from national, local, and social media sources to cover underreported areas.
    - 'incidentDate' must be the article's publication date; only include if within past 8 hours."
    """

    prompts = [
    PROMPT_STRING.replace("Nigeria", "Northern Nigeria (e.g., banditry in Zamfara, Kaduna)"),
    PROMPT_STRING.replace("Nigeria", "Southern Nigeria (e.g., militancy in Delta, cultism in Rivers)"),
    PROMPT_STRING.replace("Nigeria", "Eastern Nigeria (e.g., IPOB sit at home)"),
    PROMPT_STRING.replace("Nigeria", "Western Nigeria (e.g., Burnt down shops in Tradefair, Lagos)")
    ]

    all_news = []
    for rss in rss_links:
        for p in prompts:
            search_config = SearchParameters(
                mode="on",
                return_citations=True,
                from_date=from_date,
                to_date=to_date,
                max_search_results=30,
                sources=[
                    web_source(country="NG"),
                    news_source(country="NG"),
                    x_source(),
                    rss_source(links=[rss])
                ]
            )
            chat = client.chat.create(model="grok-4-fast-reasoning-latest", 
            messages=[user(p)], 
            search_parameters=search_config, 
            temperature=0)

            response = chat.sample()
            try:
                news_data = json.loads(response.content)
                # Filter based on full incident datetime >= from_date (naive)
                filtered_news = []
                from_date_naive = from_date.replace(tzinfo=None)  # Strip timezone for comparison
                for item in news_data:
                    date_str = item.get("incidentDate", "1900-01-01")
                    time_str = item.get("incidentTime", "00:00")
                    try:
                        # Combine date and time into full datetime (naive)
                        incident_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
                        if incident_dt >= from_date_naive:
                            filtered_news.append(item)
                    except ValueError:
                        # Skip invalid formats (log if desired: print(f"Skipping invalid date/time: {date_str} {time_str}"))
                        pass
                
                news_data = filtered_news
                all_news.extend(news_data)
            except:
                pass

    return all_news

def quick_replace(val):
    if val==None:
        return "Somewhere"
    else:
        return val

def filter_and_publish(news_data, api_key, folder="news_data"):
    """Workflow to save, deduplicate, and publish only unique news"""

    # Load past 5 days
    past_news = load_recent_news(folder, days=5)
    logging.info(past_news)

    # Save current
    filepath = save_news_to_csv(news_data, folder)

    # Deduplicate
    current_df = normalize_news(news_data)
    deduped = deduplicate_news(current_df, past_news)

    # Filter unique
    unique_news = deduped[deduped["is_duplicate"] == False]
    unique_news['lga'] = unique_news['lga'].apply(quick_replace)
    unique_news=unique_news[REQUIRED_FIELDS + OPTIONAL_FIELDS_i]

    logging.info(f"📊 Found {len(unique_news)} unique news out of {len(current_df)}")

    if not unique_news.empty:
        logging.info(unique_news.to_dict(orient="records"))
        publish_news(api_key, unique_news.to_dict(orient="records"))
    else:
        logging.info("⚠️ No unique news to publish.")


# Example integration after you parse your API response
try:    
    grok_api_key = os.getenv("XAI_API_KEY")
    convex_api_key = os.getenv("CONVEX_API_KEY")
    
    news_data = fetch_security_news(grok_api_key)
    
    if isinstance(news_data, list) and news_data:
        filter_and_publish(news_data, api_key=convex_api_key)
    else:
        logging.info("⚠️ No news items returned.")
except json.JSONDecodeError:
    logging.error("❌ Could not parse response content as JSON.")
