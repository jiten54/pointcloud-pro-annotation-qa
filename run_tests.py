#!/usr/bin/env python3
"""
PointCloud Pro - Automated Test Runner
Runs the full test suite using Python's standard unittest test discovery (compatible with pytest).
"""

import sys
import unittest

def main():
    print("=" * 65)
    print("  PointCloud Pro — Automated Test Suite Runner")
    print("=" * 65)

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir="tests", pattern="test_*.py")

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("=" * 65)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("=" * 65)

    if result.wasSuccessful():
        print("✅ ALL TESTS PASSED SUCCESSFULLY!")
        return 0
    else:
        print("❌ TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
