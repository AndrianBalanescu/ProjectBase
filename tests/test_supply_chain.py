"""Static contracts for reproducible third-party downloads and CI inputs."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]


def test_pocketbase_version_and_checksums_are_pinned():
    dockerfile = (ROOT / "Dockerfile").read_text()
    installer = (ROOT / "scripts/install.sh").read_text()

    docker_version = re.search(r"ARG PB_VERSION=([^\s]+)", dockerfile).group(1)
    install_version = re.search(r'PB_VERSION="([^"]+)"', installer).group(1)
    assert docker_version == install_version == "0.39.11"
    assert "sha256sum -c -" in dockerfile
    assert "@sha256:" in dockerfile.splitlines()[0]

    platforms = {
        "linux_amd64": "08b9fcda0d5fd42cb315dc15a36dfa121c993855bd635f01d347c31b4328ec34",
        "linux_arm64": "8c785618840df7ebba795fdf4eba33a5fed64ac5307ad8023b955b4ebb82048b",
        "linux_armv7": "ba5cde96576716ea8ecf96a11b53a4e0c376f24d93cd48e70aaee54f620ddc5e",
        "darwin_amd64": "888892fe5fe64cea4a1441937671e191b32ed8f322fa09d3d7b3ca2fc1d7be29",
        "darwin_arm64": "9da6fbe11e82c5b1704e56f7457b24682e01c510206c29b798a458119fa2be20",
    }
    for platform, digest in platforms.items():
        assert platform in installer
        assert digest in installer
    assert "curl --fail" in installer
    assert "sha256sum -c -" in installer
    assert "shasum -a 256" in installer


def test_github_actions_are_commit_pinned():
    workflow = "\n".join(
        path.read_text() for path in (ROOT / ".github" / "workflows").glob("*.yml")
    )
    refs = re.findall(r"uses:\s*([^\s#]+)", workflow)
    assert refs
    for ref in refs:
        assert re.search(r"@[0-9a-f]{40}$", ref), f"mutable action reference: {ref}"
