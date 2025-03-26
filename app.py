import os
import secrets
import cv2
import uuid
import gspread
import logging
import logging.handlers
import requests
import numpy as np
import imghdr
import pytz
import time
from flask import Flask, request, jsonify, render_template, session
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from oauth2client.service_account import ServiceAccountCredentials
from flask_talisman import Talisman
from urllib.parse import urlparse
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import google.generativeai as genai
from PIL import Image
import io
import re
import traceback
import hashlib
from cacheManager import CacheManager

load_dotenv(dotenv_path=".env")


class Config:
    SECRET_KEY = secrets.token_hex(32)
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "/tmp/uploads")
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024
    GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH")
    GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID_DEVELOPMENT")
    RECEIPT_API_ENDPOINT = os.getenv("RECEIPT_API_ENDPOINT")
    EVIDENCE_API_ENDPOINT = os.getenv("EVIDENCE_API_ENDPOINT")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    WEBHOOK_URL = os.getenv("WEBHOOK_URL")
    SCOPES = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive",
    ]

class ProductionConfig(Config):
    DEBUG = False
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"

class DevelopmentConfig(Config):
    DEBUG = True
    SESSION_COOKIE_SECURE = False
    

env = os.getenv("FLASK_ENV", "production")
config_class = ProductionConfig if env == "production" else DevelopmentConfig
executor = ThreadPoolExecutor(max_workers=3)  # Bisa disesuaikan

# cahce manager 
cm=CacheManager()

app = Flask(__name__)
app.config.from_object(config_class)
app.config.from_object(Config)
print(app.config["WEBHOOK_URL"])

handler = logging.handlers.RotatingFileHandler(
    "app.log", maxBytes=1000000, backupCount=10
)
formatter = logging.Formatter(
    "%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]"
)
handler.setFormatter(formatter)
handler.setLevel(logging.INFO)
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)

Talisman(app, content_security_policy=None)

upload_folder = app.config["UPLOAD_FOLDER"]
os.makedirs(upload_folder, exist_ok=True)

def init_gspread_client():
    scope = app.config["SCOPES"]
    creds = ServiceAccountCredentials.from_json_keyfile_name(
        app.config["GOOGLE_CREDENTIALS_PATH"], scope
    )
    return gspread.authorize(creds)

def get_rencana_details_from_sheet(rencana_id):
    client = init_gspread_client()
    sheet = client.open_by_key(app.config["GOOGLE_SHEET_ID"]).worksheet("RENCANA")
    records = sheet.get_all_records()
    for record in records:
        id_value = record.get("id rencana", "")
        if id_value:
            try:
                id_int = int(id_value)
                record_id = f"{id_int:05d}"
            except ValueError:
                record_id = str(id_value).strip()
            if record_id == str(rencana_id).strip():
                return {
                    "start_date_ar": record.get("start date A/R", ""),
                    "end_date_ar": record.get("end date A/R", ""),
                    "requestor": record.get("Pemohon", ""),
                    "unit": record.get("Unit", ""),
                    "nominal": record.get("Nominal", ""),
                    "id_rencana": record_id,
                }
    raise Exception("ID Rencana not found")

def generate_temp_filename(extension=".jpg"):
    return f"temp_{uuid.uuid4().hex}{extension}"

def set_google_credentials(json_path):
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Google credentials file not found at {json_path}")
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = json_path

def get_google_sheet():
    client = init_gspread_client()
    return client.open_by_key(app.config["GOOGLE_SHEET_ID"]).worksheet("REKAPREALISASI")

def extract_total_from_receipt_gemini(image_path):
    """
    Mengekstrak nilai total dari gambar struk belanja menggunakan Gemini API (TANPA REGEX).

    Args:
        image_path: Path ke file gambar struk belanja.

    Returns:
        Nilai total struk (float) jika berhasil ditemukan, None jika tidak ditemukan atau error.
    """
    try:
        genai.configure(api_key=app.config["GEMINI_API_KEY"])
        model = genai.GenerativeModel('gemini-2.0-flash')
        gambar_pil = Image.open(image_path)
        gambar_byte_stream = io.BytesIO()
        gambar_pil.save(gambar_byte_stream, format=gambar_pil.format)
        gambar_bytes = gambar_byte_stream.getvalue()

        image_parts = [
            {
                'mime_type': 'image/png' if image_path.lower().endswith(('.png')) else 'image/jpeg',
                'data': gambar_bytes
            },
        ]
        # Prompt yang disederhanakan, meminta nilai total dalam format angka saja
        prompt_text = "Ekstrak total nilai belanja dari struk ini. Berikan hasilnya HANYA dalam format angka saja, tanpa simbol mata uang atau teks lainnya."

        request_content = [image_parts[0], prompt_text]

        response = model.generate_content(request_content)
        response.resolve()

        # Tambahkan baris ini untuk mencetak response.text
        print("\n--- response.text dari Gemini API ---")
        print(response.text)
        print("--- Akhir response.text ---")

        teks_respon = response.text.strip() # Ambil teks respon dan trim whitespace

        try:
            nilai_total = float(teks_respon) # Langsung coba konversi response.text ke float
            return nilai_total
        except ValueError:
            app.logger.warning("Gagal mengkonversi teks respon Gemini ke float.")
            app.logger.debug(f"Teks Respon Gemini API (gagal float): {teks_respon}")
            return None

    except Exception as e:
        app.logger.error(f"Terjadi kesalahan saat memanggil Gemini API: {e}", exc_info=True)
        return None


def append_to_sheet(amount, rencana_id, account_skkos_id, uraian, judulLaporan, receipt_link, evidence_links, cost_center):
    client = init_gspread_client()
    sheet = client.open_by_key(app.config["GOOGLE_SHEET_ID"]).worksheet("REKAPREALISASI")
    gmt8 = pytz.timezone("Asia/Singapore")
    current_time = datetime.now(gmt8).strftime("%d.%m.%Y %H:%M:%S")
    data_to_append = [
        current_time,          # Column A - Timestamp
        amount,               # Column B - Amount
        rencana_id,          # Column C - Rencana ID
        receipt_link,        # Column D - Receipt Link
        evidence_links,      # Column E - Evidence Links
        account_skkos_id,    # Column F - Account SKKO
        "",                  # Column G - Empty
        uraian,             # Column H - Uraian
        judulLaporan,       # Column I - Judul Laporan
        "",                 # Column J - Empty
        cost_center,        # Column K - Cost Center
    ]
    next_row = len(sheet.col_values(1)) + 1
    sheet.insert_row(data_to_append, next_row)
    

def query_from_sheet(sheet_name, column_idx):
    client = init_gspread_client()
    sheet = client.open_by_key(app.config["GOOGLE_SHEET_ID"]).worksheet(sheet_name)
    return sheet.col_values(column_idx)

def get_unique_latest_entries(entries, max_entries=3):
    unique = []
    seen = set()
    for entry in reversed(entries):
        entry_clean = entry.strip()
        if entry_clean and entry_clean not in seen:
            unique.append(entry_clean)
            seen.add(entry_clean)
            if len(unique) == max_entries:
                break
    return unique[::-1]

cache_judul_suggestions = {
    "data": [],
    "timestamp": 0
}
TTL_JUDUL = 60

cache_uraian_suggestions = {
    "data": [],
    "timestamp": 0
}
TTL_URAIAN = 60

def fetch_judul_laporan_suggestions():
    current_time = time.time()
    if current_time - cache_judul_suggestions["timestamp"] > TTL_JUDUL:
        client = init_gspread_client()
        sheet = client.open_by_key(app.config["GOOGLE_SHEET_ID"]).worksheet("REKAPREALISASI")
        judul_laporan_column = sheet.col_values(9)[1:]
        unique_latest = get_unique_latest_entries(judul_laporan_column, max_entries=3)
        cache_judul_suggestions["data"] = unique_latest
        cache_judul_suggestions["timestamp"] = current_time
    return cache_judul_suggestions["data"]

def fetch_uraian_laporan_suggestions():
    current_time = time.time()
    if current_time - cache_uraian_suggestions["timestamp"] > TTL_URAIAN:
        client = init_gspread_client()
        sheet = client.open_by_key(app.config["GOOGLE_SHEET_ID"]).worksheet("REKAPREALISASI")
        uraian_laporan_column = sheet.col_values(8)[1:]
        unique_latest = get_unique_latest_entries(uraian_laporan_column, max_entries=3)
        cache_uraian_suggestions["data"] = unique_latest
        cache_uraian_suggestions["timestamp"] = current_time
    return cache_uraian_suggestions["data"]

@app.route("/")
def index():
    return render_template("index.html")
@app.route("/perencanaan")
def perencanaan():
    return render_template("perencanaan.html")

@app.route("/fetch_judul_laporan_suggestions", methods=["GET"])
def fetch_judul_laporan_suggestions_api():
    try:
        suggestions = fetch_judul_laporan_suggestions()
        return jsonify(suggestions)
    except Exception as e:
        app.logger.error(f"Error fetching Judul Laporan suggestions: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route("/fetch_uraian_laporan_suggestions", methods=["GET"])
def fetch_uraian_laporan_suggestions_api():
    try:
        suggestions = fetch_uraian_laporan_suggestions()
        return jsonify(suggestions)
    except Exception as e:
        app.logger.error(f"Error fetching Uraian Laporan suggestions: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route("/get_rencana_details")
def get_rencana_details():
    rencana_id = request.args.get("rencana_id")
    try:
        data = get_rencana_details_from_sheet(rencana_id)
        return jsonify(data)
    except Exception as e:
        app.logger.error(f"Error fetching Rencana details: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route("/submit", methods=["POST"])
def submit_data():
    receipt_api_endpoint = app.config["RECEIPT_API_ENDPOINT"]
    parsed = urlparse(receipt_api_endpoint)
    if not parsed.scheme or not parsed.netloc:
        return jsonify({"error": "Invalid Receipt API endpoint"}), 500
    app.logger.info(f"Using Receipt API endpoint: {receipt_api_endpoint}")
    rencana_id = request.form.get("rencana_id")
    account_skkos_id = request.form.get("account_skkos_id")
    currency = request.form.get("currency")
    amount = request.form.get("amount")
    uraian = request.form.get("uraian")
    judulLaporan = request.form.get("judulLaporan")
    cost_center = request.form.get("cost_center")  # Add this line

    # Update validation to include cost_center
    if not all([rencana_id, account_skkos_id, currency, amount, uraian, judulLaporan, cost_center]):
        return jsonify({"success": False, "message": "Input formulir tidak lengkap"}), 400
    file_path = session.get("receipt_file_path")
    filename = session.get("receipt_filename")
    content_type = session.get("receipt_content_type")
    extracted_text = session.get("extracted_text")
    if not file_path or not filename or not content_type:
        return jsonify({"error": "No receipt file found to upload."}), 400
    receipt_payload = {
        "accountSKKO": account_skkos_id,
        "extracted_text": extracted_text,
    }
    with open(file_path, "rb") as receipt_file:
        receipt_files = {
            "file": (secure_filename(filename), receipt_file, content_type)
        }
        try:
            receipt_api_response = requests.post(
                app.config["RECEIPT_API_ENDPOINT"],
                data=receipt_payload,
                files=receipt_files,
                timeout=500
            )
        except requests.Timeout:
            return jsonify({"error": "Receipt API request timed out."}), 504
    if receipt_api_response.status_code == 200:
        receipt_api_data = receipt_api_response.json()
        if receipt_api_data.get("status") == "success":
            receipt_link = receipt_api_data["data"]["fileLink"]
            os.remove(file_path)
            session.pop("receipt_file_path", None)
            session.pop("receipt_filename", None)
            session.pop("receipt_content_type", None)
            session.pop("extracted_text", None)
        else:
            app.logger.error(f"Receipt API failed: {receipt_api_data.get('message')}")
            return jsonify({"error": "Failed to upload receipt to Receipt API."}), 500
    else:
        app.logger.error(f"Receipt API responded with status code {receipt_api_response.status_code}")
        return jsonify({"error": "Receipt API responded with an error."}), 500
    evidence_links = []
    if "evidence_files" in request.files:
        evidence_files = request.files.getlist("evidence_files")
        files_payload = []
        for file in evidence_files:
            if file.filename == "":
                continue
            file_type = imghdr.what(file)
            if not file_type:
                continue
            file.seek(0, os.SEEK_END)
            file_length = file.tell()
            if file_length > 100 * 1024 * 1024:
                continue
            file.seek(0)
            files_payload.append(
                ("files", (secure_filename(file.filename), file.read(), file.content_type))
            )
        if files_payload:
            data_payload = {
                "accountSKKO": account_skkos_id,
            }
            try:
                evidence_api_response = requests.post(
                    app.config["EVIDENCE_API_ENDPOINT"],
                    data=data_payload,
                    files=files_payload,
                    timeout=500
                )
                if evidence_api_response.status_code == 200:
                    evidence_api_data = evidence_api_response.json()
                    if evidence_api_data.get("status") == "success":
                        data = evidence_api_data.get("data", {})
                        if isinstance(data, list):
                            for item in data:
                                file_link = item.get("fileLink")
                                if file_link:
                                    evidence_links.append(file_link)
                        elif isinstance(data, dict):
                            file_link = data.get("fileLink")
                            if file_link:
                                evidence_links.append(file_link)
                    else:
                        app.logger.error(f"Evidence API failed: {evidence_api_data.get('message')}")
                else:
                    app.logger.error(f"Evidence API responded with status code {evidence_api_response.status_code}")
            except Exception as e:
                app.logger.error(f"Exception during upload to Evidence API: {str(e)}", exc_info=True)
    append_to_sheet(
        amount,
        rencana_id,
        account_skkos_id,
        uraian,
        judulLaporan,
        receipt_link,
        ", ".join(evidence_links),
        cost_center,  # Add this parameter
    )
    return jsonify(success=True, message="Data saved successfully! Files uploaded to Google Drive via APIs.")

@app.route("/submit/perencanaan", methods=["POST"])
def submit_data_perencanaan():
    # Ambil data dari request JSON
    data = request.get_json()
    
    # Validasi field wajib
    required_fields = [
        "pemohon", "noHp", "accountable", 
        "unit", "perihal", "daftarBarang", "total"
    ]
    
    # Cek field utama
    missing_fields = [field for field in required_fields if not data.get(field)]
    if missing_fields:
        return jsonify({
            "success": False,
            "message": f"Field berikut wajib diisi: {', '.join(missing_fields)}"
        }), 400

    # Validasi daftar barang (sesuai kolom sheet generetepdfrencana)
    for index, barang in enumerate(data["daftarBarang"]):
        required_item_fields = [
            "nama", "satuan", "harga", 
            "jumlah", "total"  # Currency tidak dimasukkan ke sheet
        ]
        missing_item_fields = [field for field in required_item_fields if not barang.get(field)]
        
        if missing_item_fields:
            return jsonify({
                "success": False,
                "message": f"Barang ke-{index+1} belum lengkap: {', '.join(missing_item_fields)}"
            }), 400

    # Validasi tipe data numerik
    try:
        int(data["noHp"])  # Validasi nomor HP
        for barang in data["daftarBarang"]:
            float(barang["harga"])
            int(barang["jumlah"])
            float(barang["total"])
        float(data["total"])
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "message": "Format numerik tidak valid"
        }), 400

    # Format data untuk disimpan
    try:
        rencana_data = {
            "pemohon": data["pemohon"],
            "noHp": data["noHp"],
            "accountable": data["accountable"],
            "unit": data["unit"],
            "perihal": data["perihal"],
            "total": data["total"]
        }
        
        barang_data = [{
            "nama": item["nama"],
            "satuan": item["satuan"],
            "harga": item["harga"],
            "jumlah": item["jumlah"],
            "total": item["total"]
        } for item in data["daftarBarang"]]

        id_rencana = append_to_perencanaan(rencana_data, barang_data)

        # hookOnFormSubmit = requests.get(app.config["WEBHOOK_URL"])
    
        # if hookOnFormSubmit.status_code == 200:
        #     print("Trigger berhasil dikirim!")
        # else:
        #     print(f"Trigger gagal, error: {hookOnFormSubmit.text}")
        def trigger_webhook():
            try:
                hookOnFormSubmit = requests.get(app.config["WEBHOOK_URL"])
                if hookOnFormSubmit.status_code == 200:
                    print("Trigger berhasil dikirim!")
                else:
                    print(f"Trigger gagal, error: {hookOnFormSubmit.text}")
            except Exception as e:
                print(f"Webhook error: {str(e)}")
        
        # Jalankan request webhook secara async
        executor.submit(trigger_webhook)
        
    except Exception as e:
        app.logger.error(f"Gagal menyimpan data: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Terjadi kesalahan server saat menyimpan data"
        }), 500

    return jsonify({
        "success": True,
        "message": "Data berhasil disimpan",
        "data": {
            "id_rencana": id_rencana,
            "pemohon": data["pemohon"],
            "unit": data["unit"],
            "total": data["total"]
        }
    })

def add_business_days(start_date, business_days_to_add):
    current_date = start_date
    days_added = 0
    while days_added < business_days_to_add:
        current_date += timedelta(days=1)
        if current_date.weekday() < 5:  # 0-4 = Senin-Jumat
            days_added += 1
    return current_date

def append_to_perencanaan(rencana_data, barang_data):
    try:
        client = init_gspread_client()
        gmt8 = pytz.timezone("Asia/Singapore")
        # Waktu saat ini

        current_datetime = datetime.now(gmt8)
        current_time = current_datetime.strftime("%d/%m/%Y %H:%M:%S")
        
        # ================= PERHITUNGAN TANGGAL =================
        # Start Date: 7 hari setelah tanggal sekarang
        start_date = current_datetime + timedelta(days=7)
        
        # End Date: 5 hari kerja setelah start date (lewati Sabtu-Minggu)
        end_date = add_business_days(start_date, 4)
        
        # Format tanggal
        formatted_start_date = start_date.strftime("%d/%m/%Y")
        formatted_end_date = end_date.strftime("%d/%m/%Y")

        # ================= SHEET RENCANA =================
        sheet_rencana = client.open_by_key(app.config["GOOGLE_SHEET_ID"]).worksheet("RENCANA")
        
        # Generate ID Rencana (Timestamp Unix)
        nip_for_id = rencana_data["accountable"].split("_")[1]
        id_rencana = f"{nip_for_id}{int(datetime.now(gmt8).timestamp())}"
        
        # Format data untuk sheet rencana
        rencana_row = [
            current_time,               # Timestamp submit
            formatted_start_date,       # Start Date
            formatted_end_date,         # End Date
            rencana_data["pemohon"],    # Pemohon
            rencana_data["accountable"],# Accountable
            rencana_data["perihal"],    # Perihal
            rencana_data["noHp"],       # No HP
            rencana_data["unit"],       # Unit
            rencana_data["total"],      # Total
            id_rencana                  # ID Rencana
        ]
        
        # Tambahkan ke sheet rencana
        sheet_rencana.append_row(rencana_row,table_range="A1")
        
        # ================= SHEET GENERETEPDFRENCANA =================
        sheet_pdf = client.open_by_key(app.config["GOOGLE_SHEET_ID"]).worksheet("GENERATEPDFRENCANA")
        
        # Format data barang
        pdf_rows = []
        for barang in barang_data:
            pdf_row = [
                id_rencana,            # id_rencana
                barang["nama"],        # nama_barang
                barang["satuan"],      # satuan
                barang["harga"],       # harga
                barang["jumlah"],      # jumlah
                barang["total"]        # total
            ]
            pdf_rows.append(pdf_row)
        
        # Tambahkan semua barang sekaligus
        if pdf_rows:
            sheet_pdf.append_rows(pdf_rows)
            
        return id_rencana
        
    except Exception as e:
        app.logger.error(f"Gagal menyimpan ke Google Sheet: {str(e)}")
        app.logger.error(f"Detail error: {traceback.format_exc()}")
        raise e


@app.route("/fetch_id_rencana", methods=["GET"])
def fetch_id_rencana():
    try:
        client = init_gspread_client()
        sheet = client.open_by_key(app.config["GOOGLE_SHEET_ID"]).worksheet("RENCANA")
        records = sheet.get_all_records()
        id_rencana_data = []
        for record in records:
            id_value = record.get("id rencana", "")
            if id_value:
                try:
                    id_int = int(id_value)
                    id_str = f"{id_int:05d}"
                except ValueError:
                    id_str = str(id_value).strip()
                id_rencana_data.append(id_str)
        return jsonify(id_rencana_data), 200
    except Exception as e:
        app.logger.error(f"Error fetching Id Rencana: {str(e)}", exc_info=True)
        return jsonify({"error": "Error fetching Id Rencana"}), 500

@app.route("/fetch_pemohon", methods=["GET"])
@cm.cached("fetch_pemohon")
def fetch_pemohon():
    try:

        pemohon = query_from_sheet("REQUESTOR", 4)[1:]
        return jsonify({"pemohon": pemohon}), 200
    except Exception as e:
        app.logger.error(f"Error fetching pemohon: {str(e)}", exc_info=True)
        return jsonify({"error": "Error fetching pemohon"}), 500

@app.route("/fetch_accountable", methods=["GET"])
@cm.cached("fetch_accountable")
def fetch_accountable():
    try:
        accountable = query_from_sheet("ACCOUNTABLE", 4)[1:]
        return jsonify({"accountable": accountable}), 200
    except Exception as e:
        app.logger.error(f"Error fetching accountable: {str(e)}", exc_info=True)
        return jsonify({"error": "Error fetching accountable"}), 500

@app.route("/fetch_unit", methods=["GET"])
@cm.cached("fetch_unit")
def fetch_unit():
    try:
        unit = query_from_sheet("UNIT", 1)[1:]
        return jsonify({"unit": unit}), 200
    except Exception as e:
        app.logger.error(f"Error fetching unit: {str(e)}", exc_info=True)
        return jsonify({"error": "Error fetching unit"}), 500

@app.route("/fetch_satuan", methods=["GET"])
@cm.cached("fetch_satuan")
def fetch_satuan():
    try:
        satuan = list(set(query_from_sheet("GENERATEPDFRENCANA", 3)[7:]))
        return jsonify({"satuan": satuan}), 200
    except Exception as e:
        app.logger.error(f"Error fetching satuan: {str(e)}", exc_info=True)
        return jsonify({"error": "Error fetching satuan"}), 500


@app.route("/fetch_account_skkos", methods=["GET"])
def fetch_account_skkos():
    try:
        account_skkos_data = query_from_sheet("ACCOUNTLIST", 1)
        return jsonify(account_skkos_data), 200
    except Exception as e:
        app.logger.error(f"Error fetching Account SKKOs: {str(e)}", exc_info=True)
        return jsonify({"error": "Error fetching Account SKKOs"}), 500

@app.route("/fetch_cost_center", methods=["GET"])
def fetch_cost_center():
    try:
        cost_center_data = query_from_sheet("costcenter", 1)
        return jsonify(cost_center_data), 200
    except Exception as e:
        app.logger.error(f"Error fetching Cost Center: {str(e)}", exc_info=True)
        return jsonify({"error": "Error fetching Cost Center"}), 500

@app.route("/upload_file", methods=["POST"])
def upload_file_route():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    file_type = imghdr.what(file)
    if not file_type:
        return jsonify({"error": "Invalid image file."}), 400
    file.seek(0, os.SEEK_END)
    file_length = file.tell()
    if file_length > 100 * 1024 * 1024:
        return jsonify({"error": "File size exceeds 100MB limit."}), 400
    file.seek(0)
    np_img = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
    temp_filename = generate_temp_filename()
    file_path = os.path.join(app.config["UPLOAD_FOLDER"], temp_filename)
    cv2.imwrite(file_path, image)
    set_google_credentials(app.config["GOOGLE_CREDENTIALS_PATH"])

    extracted_total = extract_total_from_receipt_gemini(file_path)

    if extracted_total is not None:
        app.logger.info(f"Extracted Total from Gemini: {extracted_total}")
        session["receipt_file_path"] = file_path
        session["receipt_filename"] = file.filename
        session["receipt_content_type"] = file.content_type
        return jsonify({"extracted_text": str(extracted_total), "message": "Total value extracted successfully using Gemini API."}), 200
    else:
        session["receipt_file_path"] = file_path
        session["receipt_filename"] = file.filename
        session["receipt_content_type"] = file.content_type
        return jsonify({"error": "Maaf...Total tidak ditemukan oleh Gemini, silahkan input manual."}), 404

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8081)