import argparse
import time

from .ml_inference_worker import run_worker


def main():
    parser = argparse.ArgumentParser(description="Continuous ML inference worker (cron-like loop)")
    parser.add_argument("--interval", type=int, default=60, help="Seconds between runs")
    parser.add_argument("--limit", type=int, default=20, help="Max events per run")
    args = parser.parse_args()

    print(f"Starting continuous worker: interval={args.interval}s, limit={args.limit}")
    try:
        while True:
            processed = run_worker(limit=args.limit)
            print(f"Processed {processed} events")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("Worker stopped")


if __name__ == "__main__":
    main()
