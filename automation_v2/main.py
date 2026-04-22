import schedule
import time
import datetime
from src.processor import run_processor
from src.reporter import run_reporter
from src.config import POLLING_INTERVAL_MINUTES, REPORT_TIME
from src.campaign_manager import send_weekly_summary_to_nikhil

def main():
    print("========================================")
    print("Project Management Automation System")
    print(f"Startup Time: {datetime.datetime.now()}")
    print(f"Polling Interval: every {POLLING_INTERVAL_MINUTES} minutes")
    print(f"Daily Report Time: {REPORT_TIME}")
    print("========================================\n")

    # 1. Immediate Run
    print("Running initial process...")
    run_processor()

    # 2. Schedule the Polling Task
    schedule.every(POLLING_INTERVAL_MINUTES).minutes.do(run_processor)

    # 3. Schedule the Daily Report Task
    schedule.every().day.at(REPORT_TIME).do(run_reporter)

    # 4. Schedule Weekly Summary for Nikhil (Sundays at 10:00)
    schedule.every().sunday.at("10:00").do(send_weekly_summary_to_nikhil)

    print("System is running and waiting for tasks...")
    
    # 4. Main Loop
    try:
        while True:
            schedule.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nSystem stopped by user.")
    except Exception as e:
        print(f"\nSystem crashed due to error: {e}")

if __name__ == "__main__":
    main()
