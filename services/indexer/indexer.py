import os
import pandas as pd
from elasticsearch import Elasticsearch
import time
import glob
from flask import Flask, jsonify, request
from flask_cors import CORS

time.sleep(10)

es_host = os.environ.get('ES_HOST', 'localhost')
es_port = os.environ.get('ES_PORT', '9200')
es = Elasticsearch([f'http://{es_host}:{es_port}'])

while not es.ping():
    print("Waiting for Elasticsearch...")
    time.sleep(5)

print("Connected to Elasticsearch")

index_name = 'support_cases'
system_ready = False

if not es.indices.exists(index=index_name):
    es.indices.create(
        index=index_name,
        body={
            "mappings": {
                "properties": {
                    "title": {"type": "text", "analyzer": "standard"},
                    "description": {"type": "text", "analyzer": "standard"},
                    "customer_email": {"type": "keyword"},
                    "tags": {"type": "text", "analyzer": "standard"},
                    "ticket_id": {"type": "keyword"},
                    "created_date": {"type": "date"},
                    "status": {"type": "keyword"},
                    "priority": {"type": "integer"},
                    "category": {"type": "keyword"},
                    "resolution_time": {"type": "long"},
                    "agent_notes": {"type": "text"}
                }
            }
        }
    )
    print(f"Created index: {index_name}")

csv_files = glob.glob('/data/*.csv')
print(f"Found {len(csv_files)} CSV files to process")

for csv_file in csv_files:
    print(f"Processing {csv_file}...")
    
    try:
        df = pd.read_csv(csv_file)
        
        for idx, row in df.iterrows():
            doc = {
                "title": row['title'],
                "description": row['description'],
                "customer_email": row['customer_email'],
                "tags": row['tags'],
                "ticket_id": row['ticket_id'],
                "created_date": row['created_date'],
                "status": row['status'],
                "priority": row.get('priority', 3),
                "category": row.get('category', 'general'),
                "resolution_time": 0,
                "agent_notes": ""
            }
            
            es.index(
                index=index_name,
                id=row['customer_email'],
                body=doc
            )
        
        print(f"Indexed {len(df)} documents from {csv_file}")
        
    except Exception as e:
        print(f"Error processing {csv_file}: {e}")

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"ready": system_ready, "timestamp": int(time.time() * 1000)})

@app.route('/update_status', methods=['POST'])
def update_status():
    data = request.json
    email = data.get('email')
    new_status = data.get('status')
    
    if not email or not new_status:
        return jsonify({"error": "Missing email or status"}), 400
    
    try:
        es.update_by_query(
            index=index_name,
            body={
                "query": {
                    "match": {
                        "customer_email": email
                    }
                },
                "script": {
                    "source": "ctx._source.status = params.status",
                    "params": {
                        "status": new_status
                    }
                }
            }
        )
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

print("Indexing complete!")
system_ready = True

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000) 