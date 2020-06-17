#! /bin/bash

set -e

# Boost file watcher limit
sudo sh -c 'echo "fs.inotify.max_user_watches=524288" >> /etc/sysctl.conf'
sudo sysctl -p

echo "Installing Zip"
sudo apt install zip

echo "Installing GCC"
sudo apt install gcc

echo "Downloading and Installing CUDA"
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu1804/x86_64/cuda-ubuntu1804.pin
sudo mv cuda-ubuntu1804.pin /etc/apt/preferences.d/cuda-repository-pin-600
wget http://developer.download.nvidia.com/compute/cuda/10.2/Prod/local_installers/cuda-repo-ubuntu1804-10-2-local-10.2.89-440.33.01_1.0-1_amd64.deb
sudo dpkg -i cuda-repo-ubuntu1804-10-2-local-10.2.89-440.33.01_1.0-1_amd64.deb
sudo apt-key add /var/cuda-repo-10-2-local-10.2.89-440.33.01/7fa2af80.pub
sudo apt-get update
sudo apt-get -y install cuda

echo "Downloading Miniconda"
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda.sh
echo "Installing Miniconda"
bash ~/miniconda.sh -b -p $HOME/miniconda
source miniconda/bin/activate
conda init

echo "Creating and activating anaconda environment"
conda create -n transformers python pandas tqdm
conda activate transformers
echo 'conda activate transformers' >> .bashrc

echo "Installing anaconda libraries"
conda install pytorch cudatoolkit=10.2 -c pytorch

echo "Building Apex for FP16 training"
git clone https://github.com/NVIDIA/apex
cd apex
pip install -v --no-cache-dir --global-option="--cpp_ext" --global-option="--cuda_ext" ./
cd ..

# Install simpletransformers (https://simpletransformers.ai/) library wrapping HuggingFace's Transformners (https://huggingface.co/transformers/)
echo "Installing simpletransformers"
pip install simpletransformers

echo "Installing Node"
sudo apt -y install curl dirmngr apt-transport-https lsb-release ca-certificates
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt -y install nodejs

echo "Installing NPM Packages"
npm i typescript ts-node @azure/storage-blob @types/node

echo "Installing various utilities"
sudo apt install unzip

echo "Cleaning up"
rm cuda-repo-ubuntu1804-10-2-local-10.2.89-440.33.01_1.0-1_amd64.deb

echo "Done :)"