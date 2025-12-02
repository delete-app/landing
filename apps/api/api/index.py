from mangum import Mangum
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from app.main import app

handler = Mangum(app, lifespan="off")
